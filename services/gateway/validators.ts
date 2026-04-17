/**
 * services/gateway/validators.ts
 *
 * Gateway API calls for validators: fetching, uptime calculation,
 * geolocation, and network stats computation.
 * Used by: app/api/validators, app/[locale]/dashboard/page.tsx.
 */

import { getGateway, withRetry, runWithLimit, runInBatches, CONCURRENCY, type Network } from './client';
import logger from '@/lib/logger';
import { sanitizeText, sanitizeIconUrl, isValidUrl } from '@/utils/sanitize';
import { roundTo } from '@/utils/validators';
import protocolVotesCacheRaw from '@/constants/protocol-votes.json';
import type { Validator, NetworkStats } from '@/types/radix';
import { unstable_cache } from 'next/cache';
import { Redis } from '@upstash/redis';


// ── Opaque Gateway response type aliases ─────────────────────────────────────
type GatewayMetadata   = {
    items: Array<{
        key: string;
        value: {
            typed?: { value: string | number | boolean };
            programmatic_json?: {
                value?: string | number | boolean;
                fields?: Array<{ kind: string; value: string }>;
            };
        };
    }>;
};
type GatewayValidator  = { 
    address: string; 
    metadata?: GatewayMetadata; 
    state?: {
        is_registered?: boolean;
        accepts_delegated_stake?: boolean;
        stake_unit_resource_address?: string;
        public_key?: { key_hex: string };
        consensus_public_key?: { key_hex: string };
        owner_role?: unknown;
    }; 
    active_in_epoch?: { stake: string }; 
    stake_vault?: { balance: string };
    stake_unit_resource_address?: string;
    locked_owner_stake_unit_vault?: { balance: string };
    details?: { 
        total_supply?: string; 
        total_minted?: string; 
        public_key?: { key_hex: string };
    };
    effective_fee_factor?: { 
        current?: { fee_factor?: number }; 
        pending?: { fee_factor?: number }; 
    };
};
type GatewayUptimeItem = { 
    address: string; 
    proposals_made?: number; 
    proposals_missed?: number; 
};
type GatewayResponse   = { 
    items?: GatewayValidator[]; 
    validators?: { items?: GatewayValidator[]; next_cursor?: string } | GatewayValidator[]; 
};

const protocolVotesCache = protocolVotesCacheRaw as Record<string, string>;
// ── Server-side holders cache ─────────────────────────────────────────────────
// Caches LSU holder counts per resource address (slow-changing data).
const holdersCache = new Map<string, { count: number; expiry: number }>();
const HOLDERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes


const METADATA_KEYS = {
    NAME: 'name',
    DESCRIPTION: 'description',
    ICON_URL: 'icon_url',
    INFO_URL: 'info_url',
    URL: 'url',
    VERSION: 'validator_version',
    COMMIT: 'validator_commit',
    PROVIDER: 'hosting_provider',
    COUNTRY: 'country',
};

const PROTOCOL_SIGNALS: Record<string, string> = {
    '96e00440adafe5e2000000cuttlefish': 'Cuttlefish'
};

function getMetadataValue(metadata: GatewayMetadata | null | undefined, key: string): string {
    if (!metadata || !metadata.items) return '';
    const item = metadata.items.find((i) => i.key === key);
    if (!item || !item.value) return '';

    const value = item.value;
    let raw = '';
    const typedValue = value.typed;
    const programmatic = value.programmatic_json;
    if (typedValue && typedValue.hasOwnProperty('value')) {
        raw = String(typedValue.value);
    } else if (programmatic) {
        if (programmatic.hasOwnProperty('value')) {
            raw = String(programmatic.value);
        } else if (Array.isArray(programmatic.fields)) {
            const stringField = programmatic.fields.find((f) => f.kind === 'String' || f.kind === 'Url');
            if (stringField) raw = String(stringField.value);
        }
    }
    // Sanitize all metadata text to prevent XSS / layout breakage
    return sanitizeText(raw);
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

const BATCH_SIZE      = 150;
const LSU_CHUNK_SIZE  = 20;  // /state/entity/details allows max 20 addresses per request
const EPOCH_HISTORY   = 5;    // 6 per-epoch entries — enough for last 6 epochs as requested

/* ═══════ GEOLOCATION HELPERS ═══════ */
interface GeoData {
    status: string;
    country?: string;
    countryCode?: string;
    org?: string;
    isp?: string;
}

const geoCache = new Map<string, GeoData>();

async function fetchLocationData(ipOrHost: string): Promise<GeoData | null> {
    if (!ipOrHost) return null;
    if (geoCache.has(ipOrHost)) return geoCache.get(ipOrHost)!;

    try {
        // Use ip-api.com (Note: demo endpoint, using http as free tier is http)
        const res = await fetch(`http://ip-api.com/json/${ipOrHost}`);
        const data = await res.json();
        if (data.status === 'success') {
            geoCache.set(ipOrHost, data);
            return data;
        }
    } catch (err) {
        logger.warn({ ipOrHost, err }, '[fetchLocationData] Geolocation fetch failed');
    }
    return null;
}

function extractIpOrHost(metadata: GatewayMetadata | null | undefined): string {
    const keys = ['validator_ip', 'ip_address', 'host', 'hostname', 'ip', 'registered_ip'];
    if (!metadata || !metadata.items) return '';
    for (const key of keys) {
        const val = getMetadataValue(metadata, key);
        if (val && val.length > 5) return val; // Basic length check for valid IP/Host
    }
    return '';
}

/* ═══════ UPTIME HELPERS ═══════ */
function buildUptimeMap(responses: GatewayResponse[] | unknown[]): Map<string, GatewayUptimeItem> {
    const map = new Map<string, GatewayUptimeItem>();
    for (const response of responses as GatewayResponse[]) {
        const validators = response?.validators;
        const items = (Array.isArray(validators) ? validators : (validators as { items?: GatewayUptimeItem[] })?.items) ?? [];
        const arr = (Array.isArray(items) ? items : []) as GatewayUptimeItem[];
        arr.forEach((v) => { if (v.address) map.set(v.address, v); });
    }
    return map;
}

function fetchUptimeBatched(
    gateway: ReturnType<typeof import('./client').getGateway>,
    chunks:  string[][],
    from?:   number,
    at?:     number | null,
): Promise<GatewayResponse[]> {
    // runWithLimit caps simultaneous requests; withRetry handles 429s per chunk.
    return runWithLimit(
        chunks.map(chunk => () =>
            withRetry(() =>
                gateway.statistics.innerClient.validatorsUptime({
                    validatorsUptimeRequest: {
                        validator_addresses: chunk,
                        ...(from !== undefined ? { from_ledger_state: { epoch: from } } : {}),
                        ...(at  !== undefined && at !== null ? { at_ledger_state: { epoch: at } } : {}),
                    },
                }) as Promise<unknown> as Promise<GatewayResponse>
            ),
        ),
        CONCURRENCY.SNAPSHOTS,
    );
}

export interface ValidatorsFetchResult {
    validators: Validator[];
    ledgerState: {
        epoch: number;
        state_version?: number;
        round?: number;
        proposer_round_timestamp?: string;
    };
}


export async function fetchValidators(network: "mainnet" | "stokenet" = "mainnet"): Promise<Validator[]> {
    const { validators } = await fetchValidatorsWithLedger(network);
    return validators;
}

export async function fetchValidatorsWithLedger(
    network: 'mainnet' | 'stokenet' = 'mainnet',
): Promise<ValidatorsFetchResult> {
    const gateway = getGateway(network);
    const restBase = network === 'stokenet'
        ? 'https://stokenet.radixdlt.com'
        : 'https://mainnet.radixdlt.com';

    /* ── Phase 1: basic validator list + current status ──
       We use the REST API directly for the validator list so we can request
       opt_ins that the SDK wrapper doesn't expose, specifically:
         - validator_active_in_epoch  → gives us active_in_epoch.stake
         - explicit_metadata          → validator metadata (name, icon, etc.)
       The state field (stake_unit_resource_address, stake_vault, etc.) is
       always included by default in the /state/validators/list response.
    ── */
    const fetchAllValidatorsRest = async (): Promise<GatewayValidator[]> => {
        const items: GatewayValidator[] = [];
        let cursor: string | undefined = undefined;
        do {
            const body: Record<string, unknown> = {
                limit_per_page: 100,
                opt_ins: { validator_active_in_epoch: true },
            };
            if (cursor) body.cursor = cursor;
            const res = await fetch(`${restBase}/state/validators/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) break;
            try {
                const data = await res.json() as { 
                    validators?: { items?: GatewayValidator[]; next_cursor?: string };
                    items?: GatewayValidator[];
                    next_cursor?: string;
                };
                const page = data?.validators?.items ?? data?.items ?? [];
                items.push(...page);
                cursor = data?.validators?.next_cursor ?? data?.next_cursor ?? undefined;
            } catch (err) {
                logger.error({ err }, '[fetchAllValidatorsRest] JSON parse failed');
                break; 
            }
        } while (cursor);
        return items;
    };

    const [validatorsList, currentStatus] = await Promise.all([
        fetchAllValidatorsRest(),
        withRetry(() => gateway.status.getCurrent()),
    ]);

    logger.info({ 
        network, 
        rawCount: validatorsList.length,
        epoch: currentStatus.ledger_state.epoch 
    }, '[ValidatorsService] Raw validators fetched from REST API');

    if (validatorsList.length === 0) {
        logger.warn({ network, epoch: currentStatus.ledger_state.epoch }, '[ValidatorsService] EMPTY VALIDATOR LIST RETURNED BY GATEWAY');
    }

    const currentEpoch = currentStatus.ledger_state.epoch;
    const validatorAddresses = validatorsList.map(v => v.address);
    const addressChunks = chunkArray(validatorAddresses, BATCH_SIZE);

    /* ── Phase 2: all uptime queries + LSU details in parallel ── */

    // Build epoch query snapshots: now, then 14 days ago, then snapshots for each of the last N epochs
    // To get DELTAS for epoch E, we need snapshots at E and E+1
    const epochSnapshots = [currentEpoch];
    for (let i = 1; i <= EPOCH_HISTORY + 1; i++) {
        epochSnapshots.push(currentEpoch - i);
    }
    // Also need 14 days ago for "Recent"
    const recentSnapshotEpoch = currentEpoch - 4032;
    // Add null as a special marker for the absolute latest (now) snapshot
    const allSnapshots: (number | null)[] = [null, ...new Set([...epochSnapshots, recentSnapshotEpoch])].sort((a, b) => {
        if (a === null) return -1;
        if (b === null) return 1;
        return b - a;
    });

    // Collect LSU resource addresses — REST /state/validators/list puts them in state.stake_unit_resource_address
    const lsuAddresses: string[] = validatorsList
        .map((v: GatewayValidator) => {
            const s = (v?.state as Record<string, unknown>) ?? {};
            return s?.stake_unit_resource_address ||
                   v?.stake_unit_resource_address || '';
        })
        .filter(Boolean) as string[];
    const lsuChunks = chunkArray([...new Set(lsuAddresses)], LSU_CHUNK_SIZE);

    /* ── Phase 2: fan-out with bounded concurrency ──────────────────────
       The three groups run concurrently with each other (outer Promise.all)
       but each group is individually rate-limited (runWithLimit / fetched
       UptimeBatched). This gives maximum parallelism without bursting the
       Cloudflare rate-limit.

       Worst-case in-flight at peak:
         SNAPSHOTS (5) × addressChunks (1–2 for 300 validators)  ≈  10
         + ENTITY (6) chunks                                       ≈   6
         + ENTITY (6) LSU chunks                                   ≈   6
         ──────────────────────────────────────────────────────────────
         Total burst ≈ 22 req — well within the ~20 req/s limit when
         spread over the network round-trip time of each request.
    ── */

    /* ── Phase 2: fan-out ─────────────────────────────────────────────
       2a — Uptime snapshots, capped at CONCURRENCY.SNAPSHOTS per epoch.
       2b — REMOVED: getAllValidators() already returns active_in_epoch.stake,
            which is the consensus-layer XRD stake. The old stateEntityDetails
            call fetched the same 300 validators a second time just to read the
            XRD vault balance — which equals active_in_epoch.stake. Saves ~2 calls.
       2c — LSU total_supply is not in getAllValidators — still required.
    ── */
    const [snapshotResults, lsuResultsRaw] = await Promise.all([

        // 2a — Uptime snapshots
        runWithLimit(
            allSnapshots.map(epoch => () => fetchUptimeBatched(gateway, addressChunks, undefined, epoch)),
            CONCURRENCY.SNAPSHOTS,
        ),

        // 2c — LSU total supply via direct REST
        runWithLimit(
            lsuChunks.map(chunk => async () => {
                try {
                    const res = await fetch(`${restBase}/state/entity/details`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ addresses: chunk }),
                    });
                    if (!res.ok) {
                        await res.text(); // consume body to free connection
                        return { items: [] };
                    }
                    const data = await res.json();
                    return data;
                } catch {
                    return { items: [] };
                }
            }),
            CONCURRENCY.ENTITY,
        ),
    ]);

    // Build Maps for Each Snapshot
    const snapshotMaps = new Map<number | null, Map<string, GatewayUptimeItem>>();
    allSnapshots.forEach((epoch, idx) => {
        const map = buildUptimeMap(snapshotResults[idx]);
        snapshotMaps.set(epoch, map);
    });

    logger.info({ 
        network, 
        snapshotsCount: allSnapshots.length,
        uptimeMapsCreated: snapshotMaps.size 
    }, '[ValidatorsService] Uptime snapshots processed');

    // Latest Uptime (Total) is effectively the "now" snapshot
    const nowUptimeMap = snapshotMaps.get(null)!;
    const totalUptimeMap = snapshotMaps.get(currentEpoch)!;
    const recentUptimeMap = snapshotMaps.get(recentSnapshotEpoch) || new Map();

    // LSU supply map: lsuAddress → totalSupply
    const lsuSupplyMap = new Map<string, number>();
    for (const res of lsuResultsRaw) {
        const items = ((res as GatewayResponse)?.items as GatewayValidator[]) ?? [];
        for (const item of items) {
            const supply = Number(
                item?.details?.total_supply ??               // FungibleResource REST shape
                item?.details?.total_minted ??               // fallback
                0
            );
            if (item?.address && supply > 0) lsuSupplyMap.set(item.address, supply);
        }
    }

    /* ── Phase 3: build Validator objects ── */
    // ── Phase 6: geolocation (best-effort, in-memory cached) ─────────
    const geoResultsList = await runInBatches(
        validatorsList,
        (v: GatewayValidator) => {
            const ipOrHost = extractIpOrHost(v.metadata as GatewayMetadata);
            return ipOrHost ? fetchLocationData(ipOrHost) : Promise.resolve(null);
        },
        CONCURRENCY.GEO,
    );
    const geoResultsMap = new Map<string, GeoData | null>();
    validatorsList.forEach((v: GatewayValidator, i: number) => geoResultsMap.set(v.address as string, geoResultsList[i]));

    /* ── Phase 3 + 4 REMOVED ─────────────────────────────────────────
       Previously: ~250 nonFungibleLocation calls (1/validator with owner_role)
       to resolve owner account addresses, then a batched stateEntityDetails on
       those accounts to read version/commit/provider/country as a FALLBACK.
       These were the biggest burst source after uptime snapshots.
       In practice validators publish these fields directly on their own metadata;
       the owner-account path almost never added new data.
       Removed ~250 API calls per fetchValidators invocation.
    ── */

    // ── Phase 5: LSU holder counts (REST, ≤ CONCURRENCY.HOLDERS) ─────
    // This endpoint lives on the same Cloudflare origin but under a
    // different path — still rate-limited. Results are cached for 5 min
    // (holdersCache) so the ~300 REST calls are only made once per TTL
    // window regardless of how many concurrent requests arrive.
    const gatewayBaseUrl = network === 'stokenet'
        ? 'https://stokenet.radixdlt.com'
        : 'https://mainnet.radixdlt.com';

    const holdersMap = new Map<string, number>();
    const nowHolders = Date.now();

    // Separate cached vs stale addresses so we only hit the API for stale ones
    const staleLsuAddresses = lsuAddresses.filter(addr => {
        const cached = holdersCache.get(addr);
        if (cached && cached.expiry > nowHolders) {
            holdersMap.set(addr, cached.count);
            return false; // already fresh
        }
        return true; // needs refresh
    });

    if (staleLsuAddresses.length > 0) {
        const holderEntries = await runInBatches(
            staleLsuAddresses,
            addr =>
                withRetry(async () => {
                    const res = await fetch(`${gatewayBaseUrl}/extensions/resource-holders/page`, {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({ resource_address: addr, limit_per_page: 100 }),
                    });
                    // Surface HTTP 429 so withRetry can catch and back off
                    if (res.status === 429) {
                        const err = Object.assign(new Error('429'), { status: 429 });
                        // Attach a synthetic fetchResponse so _getRetryAfterMs can read the header
                        (err as Error & { fetchResponse?: Response }).fetchResponse = res;
                        throw err;
                    }
                    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
                    const totalCount = (data.total_count as number) || 0;

                    // Subtract non-account entities (pools, components) from the count.
                    const items = data.items || [];
                    const nonAccountHoldersCount = (items as Record<string, string>[]).filter(
                        (h) => h.address && !h.address.startsWith('account_')
                    ).length;

                    return { addr, count: Math.max(0, totalCount - nonAccountHoldersCount) };
                }).catch(() => ({ addr: addr as unknown as string, count: 0 })),
            CONCURRENCY.HOLDERS,
        );

        holderEntries.forEach(h => {
            holdersMap.set(h.addr as string, h.count);
            holdersCache.set(h.addr as string, { count: h.count, expiry: nowHolders + HOLDERS_CACHE_TTL });
        });

        // Prune oversized holders cache (>600 entries)
        if (holdersCache.size > 600) {
            const oldest = holdersCache.keys().next().value;
            if (oldest) holdersCache.delete(oldest);
        }
    }

    // Calculate Total Global Stake FIRST to determine the true Network APY
    // Radix emits 300,000,000 XRD per year to stakers.
    // The Base APY = (300,000,000 / Total Global Stake) * 100
    let totalGlobalStake = 0;
    validatorsList.forEach((v: GatewayValidator) => {
        const stake = Number((v.active_in_epoch as Record<string, unknown>)?.stake || 0);
        totalGlobalStake += stake;
    });

    const ANNUAL_EMISSION_XRD = 300_000_000;
    // Calculate actual base APY (e.g., if total stake is 5.2B, APY = ~5.76%)
    const baseApy = totalGlobalStake > 0 ? (ANNUAL_EMISSION_XRD / totalGlobalStake) : 0.075; // fallback to 7.5% if 0 to avoid Infinity
    const baseApyPercent = baseApy * 100;

    // Calculate network-wide protocol vote percentage
    const activeCount = validatorsList.filter((v: GatewayValidator) => v.active_in_epoch).length;
    let votedCount = 0;
    validatorsList.forEach((v: GatewayValidator) => {
        if (v.active_in_epoch && protocolVotesCache[v.address as string]) {
            votedCount++;
        }
    });
    const networkVotePercentage = activeCount > 0 ? (votedCount / activeCount) * 100 : 0;

    const validators: Validator[] = validatorsList.map((v: GatewayValidator) => {
        const _nowUp = v.active_in_epoch || totalUptimeMap.get(v.address as string);
        const _snapshotAtEpochStart = totalUptimeMap.get(v.address); // This is snapshot at currentEpoch (start of live)
        const thenUp = recentUptimeMap.get(v.address);

        const name = getMetadataValue(v.metadata, METADATA_KEYS.NAME) || `Validator ${v.address.slice(-6)}`;
        const rawWebsite = getMetadataValue(v.metadata, METADATA_KEYS.INFO_URL) || getMetadataValue(v.metadata, METADATA_KEYS.URL);
        const website = isValidUrl(rawWebsite) ? rawWebsite : '';
        const iconUrl = sanitizeIconUrl(getMetadataValue(v.metadata, METADATA_KEYS.ICON_URL));

        // ── Uptime: total (since Babylon) ──
        // v.active_in_epoch is CURRENT epoch only. 
        // Snapshot @ currentEpoch is START of live.
        // Total Uptime map holds the start of the current epoch.
        const startOfLiveStats = snapshotMaps.get(currentEpoch - 1)?.get(v.address);
        const nowStats = nowUptimeMap.get(v.address);

        const liveProposalsMade = (startOfLiveStats && nowStats) ? Math.max(0, (nowStats.proposals_made ?? 0) - (startOfLiveStats.proposals_made ?? 0)) : 0;
        const liveProposalsMissed = (startOfLiveStats && nowStats) ? Math.max(0, (nowStats.proposals_missed ?? 0) - (startOfLiveStats.proposals_missed ?? 0)) : 0;

        // Total = (Stats at START of live) + (Proposals MADE in live)
        const totalProposalsMade = (startOfLiveStats?.proposals_made ?? 0) + liveProposalsMade;
        const totalProposalsMissed = (startOfLiveStats?.proposals_missed ?? 0) + liveProposalsMissed;

        const totalPropCount = totalProposalsMade + totalProposalsMissed;
        const totalUptimePct = totalPropCount > 0 ? (totalProposalsMade / totalPropCount) * 100 : 100;

        // ── Uptime: recent (14 days delta) ──
        const recentProposalsMade = Math.max(0, totalProposalsMade - (thenUp?.proposals_made ?? 0));
        const recentProposalsMissed = Math.max(0, totalProposalsMissed - (thenUp?.proposals_missed ?? 0));
        const recentPropCount = recentProposalsMade + recentProposalsMissed;
        const recentUptimePct = recentPropCount > 0 ? (recentProposalsMade / recentPropCount) * 100 : 100;

        // ── Per-epoch performance (Deltas) ──
        const cleanEpochPerformance = [];
        for (let i = 0; i <= EPOCH_HISTORY; i++) {
            const e = currentEpoch - i;

            let made = 0;
            let missed = 0;

            if (i === 0) {
                // LIVE EPOCH (currentEpoch)
                made = liveProposalsMade;
                missed = liveProposalsMissed;
            } else {
                // FINALIZED EPOCH e
                // Proposals made = [Stats at epoch e] - [Stats at epoch e - 1] as requested
                const currentVal = snapshotMaps.get(e)?.get(v.address);
                const prevVal = snapshotMaps.get(e - 1)?.get(v.address);

                made = (currentVal && prevVal) ? Math.max(0, (currentVal.proposals_made ?? 0) - (prevVal.proposals_made ?? 0)) : 0;
                missed = (currentVal && prevVal) ? Math.max(0, (currentVal.proposals_missed ?? 0) - (prevVal.proposals_missed ?? 0)) : 0;
            }

            cleanEpochPerformance.push({
                epoch: e,
                completedProposals: made,
                missedProposals: missed,
                isLive: i === 0
            });
        }

        // ── Fee & APY ──
        const effectiveFeeFactorData = v.effective_fee_factor as { current?: { fee_factor?: number }; pending?: { fee_factor?: number } } | undefined;
        const feeFactor = Number(effectiveFeeFactorData?.current?.fee_factor || 0);
        const upcomingFeeFactor = effectiveFeeFactorData?.pending?.fee_factor !== undefined 
            ? Number(effectiveFeeFactorData.pending.fee_factor) 
            : undefined;
        
        const hasPendingFeeChange = upcomingFeeFactor !== undefined && upcomingFeeFactor !== feeFactor;
        const upcomingFee = upcomingFeeFactor !== undefined ? roundTo(upcomingFeeFactor * 100, 2) : undefined;

        const apy = baseApyPercent * (1 - feeFactor);
        const nominalFee = roundTo(feeFactor * 100, 4);
        const apyProjection = roundTo(apy, 4);
        const effectiveFee = roundTo(apy * (nominalFee / 100), 4);

        // ── Delegation ──
        // active_in_epoch.stake = consensus-layer XRD; stake_vault.balance = vault balance
        // Both represent total XRD delegated — use stake_vault.balance (confirmed path from debug)
        const delegatedStake = roundTo(Number(
            v.stake_vault?.balance ??
            v.active_in_epoch?.stake ??
            0
        ), 4);
        const stakeVaultBalance = delegatedStake;

        // ── State flags ──
        const state = v.state || {};
        const isRegistered = state?.is_registered ?? true;
        const acceptsDelegatedStake = state?.accepts_delegated_stake ?? v.active_in_epoch !== undefined;

        // locked_owner_stake_unit_vault.balance = LSU tokens held by the owner (top-level, confirmed from debug)
        const ownerLsuBalance = Number(v.locked_owner_stake_unit_vault?.balance || 0);

        // ── LSU2XRD factor ──
        // Formula: 1 LSU = (Total XRD staked) / (Total LSU supply)
        const lsuResource: string = state?.stake_unit_resource_address ||
            (v.stake_unit_resource_address as string) || '';
        const lsuTotalSupply = lsuResource ? (lsuSupplyMap.get(lsuResource) || 0) : 0;
        const lsu2xrdFactor = lsuTotalSupply > 0 ? (stakeVaultBalance / lsuTotalSupply) : 0;

        // Owner delegation = owner's LSU tokens × lsu2xrd factor (= XRD equivalent)
        const ownerDelegation = roundTo(ownerLsuBalance * (lsu2xrdFactor > 0 ? lsu2xrdFactor : 1.0), 4);

        // Try multiple locations for the public key
        const publicKey = (state?.public_key as Record<string, string>)?.key_hex ||
            (state?.consensus_public_key as Record<string, string>)?.key_hex ||
            (v.details as Record<string,Record<string,Record<string,string>>>)?.public_key?.key_hex || '';

        const rawProtocolVote = protocolVotesCache[v.address] || '';
        const protocolVote = PROTOCOL_SIGNALS[rawProtocolVote] || sanitizeText(rawProtocolVote) || 'None';

        // ── Technical & Location ──
        const geo = geoResultsMap.get(v.address);

        const _version = getMetadataValue(v.metadata, METADATA_KEYS.VERSION) || '';
        const _commit = getMetadataValue(v.metadata, METADATA_KEYS.COMMIT) || '';

        // Metadata first, then Geo fallback
        const _provider = getMetadataValue(v.metadata, METADATA_KEYS.PROVIDER) || geo?.org || geo?.isp || '';
        const _country = getMetadataValue(v.metadata, METADATA_KEYS.COUNTRY) || geo?.country || '';
        const countryCode = getMetadataValue(v.metadata, 'country_code') || geo?.countryCode || '';

        // Owner address derived from state only (no NFT location lookup)
        const ownerRole = state?.owner_role as { 
            updater?: { updater?: { non_fungible?: { local_id?: { value?: string } } } },
            updaters?: Array<{ non_fungible?: { local_id?: { value?: string } } }>
        } | undefined;
        const ownerAddress =
            ownerRole?.updater?.updater?.non_fungible?.local_id?.value ||
            ownerRole?.updaters?.[0]?.non_fungible?.local_id?.value || '';

        // ── Stake & LSU factor ────────────────────────────────────────────
        const finalXrdStake   = delegatedStake;
        const finalLsuFactor  = lsu2xrdFactor; // already computed above
        const delegatorsCount = holdersMap.get(lsuResource as string) || 0;

        // ── Technical Metadata (from validator's own metadata only) ───────
        const versionFinal  = getMetadataValue(v.metadata, METADATA_KEYS.VERSION);
        const commitFinal   = getMetadataValue(v.metadata, METADATA_KEYS.COMMIT);
        const providerFinal = getMetadataValue(v.metadata, METADATA_KEYS.PROVIDER) || geo?.org || geo?.isp || '';
        const countryFinal  = getMetadataValue(v.metadata, METADATA_KEYS.COUNTRY)  || geo?.country || '';

        return {
            id: v.address,
            name,
            address: v.address,
            iconUrl,
            description: getMetadataValue(v.metadata, METADATA_KEYS.DESCRIPTION),
            website,
            lsuResource: lsuResource,
            publicKey,
            nominalFee,
            externalStakeAccepted: acceptsDelegatedStake,
            registered: isRegistered,
            protocolUpdateVote: protocolVote,
            networkVotePercentage,
            upcomingFee,
            hasPendingFeeChange,

            recentProposalsMade,
            recentProposalsMissed,
            recentUptime: roundTo(recentUptimePct, 4),

            totalProposalsMade,
            totalProposalsMissed,
            totalUptime: roundTo(totalUptimePct, 4),

            startOfLiveProposalsMade: startOfLiveStats?.proposals_made ?? 0,
            startOfLiveProposalsMissed: startOfLiveStats?.proposals_missed ?? 0,
            serverLiveProposalsMade: liveProposalsMade,
            serverLiveProposalsMissed: liveProposalsMissed,

            rank: 0,
            delegators: delegatorsCount,
            delegatedStake: finalXrdStake,
            delegatedStakePercent: 0,
            ownerDelegation: ownerDelegation,
            ownerAddress,
            lsu2xrdFactor: finalLsuFactor,
            apyProjection,
            effectiveFee,

            onlineStatus: v.active_in_epoch !== undefined,
            acceptsConnect: acceptsDelegatedStake,
            provider: providerFinal, providerPercent: 0,
            country: countryFinal, countryPercent: 0, countryCode,

            version: versionFinal, commit: commitFinal,

            epochPerformance: cleanEpochPerformance,

            status: v.active_in_epoch ? 'active' : 'inactive',
            tags: (function () {
                const t: string[] = [];
                const address = v.address;

                if (address === 'validator_rdx1svjhajkrvar9lc4q045t5n02llhdm95wx2pampdm9tc3fglxdgjc8a' || address === 'validator_rdx1sw32mp374vrd0extsg4d6z3mwpgpalydnt5tp8a6fnsq0smax4tv35') {
                    t.push('Hispanic Community');
                }

                const FOUNDATION_NODES = [
                    'validator_rdx1sd5368vqdmjk0y2w7ymdts02cz9c52858gpyny56xdvzuheepdeyy0',
                    'validator_rdx1sdcmd3ymwzvswgyva8lpknqrzuzzmmkac9my4auk29j5feumfh77fs',
                    'validator_rdx1sv2nu2y6wmhcg4d99mjek5g8qmpc2ua73yfaz6tytgrasftamn9c2u',
                    'validator_rdx1sd5rldutwtcmnlczj38n3hrhdqevu77wkqh64kn985nmvg2dxzmz7e',
                    'validator_rdx1sv0lcmlfvwkf8zp5x3q6g3d2rk6fd6kdxvluqe3v04rzdqew6vhvgs',
                    'validator_rdx1sv5zyqk0tsma5gp4h690cug9e6ashvv3genfzf0ukevgj84t6vyn3x',
                    'validator_rdx1s0ecyev32587zjyrc50lu900q64ykxcr7er8delatak6vkk9t4g4q0',
                    'validator_rdx1sdgghcae054twgtq9rut8y5k45ged4u9ejgl6g92rvc6nkaztsznkw',
                    'validator_rdx1sw4ekx00nfjddp32vptgp48kqnr5y7ca4zsg82zchjasujya7yy6dz',
                    'validator_rdx1sdjy58guswld3pajj7kc9etmjxx4r6fpn9kg9qvmtyuktl86m6ksek',
                    'validator_rdx1s0nmk0qu3sk9nsq3yxdfn06cwfv0x6vd0zmvch0m6634d6pp2lf770',
                    'validator_rdx1sdnqgc9crzvzyq9mnnqhyg7st869r5td68wf8zq0mxkxeswwctd4ll',
                    'validator_rdx1swqujannq4qknqztw7j2gynuyqxs63ktm9p9d78gvsuwhr9wy8uvxn',
                    'validator_rdx1s089c3309u3celwxur3zrz5t8skypzcff92qezlec9maawu8d5r0na',
                    'validator_rdx1swz29wl6rvd34w34rjnnd6x0dwkc8hltc9lhr8rl8g6876egxd5s6e',
                    'validator_rdx1sw5rrhkxs65kl9xcxu7t9yu3k8ptscjwamum4phclk297j6r28g8kd',
                    'validator_rdx1sdwuys6rx7f5n2qy8kplkywq8ryyw5uj7rsac22g29lt53jzvs9kp3',
                    'validator_rdx1sv3rkch3kj85uwk9yp37v2a68alnmm8aqvd3mefswcvn94ch2l2nnj',
                    'validator_rdx1sd4eq4vvnrmtxy0l4wxaykugwjmyflnnkn4sz3p9jv79ac2sv5sh88',
                    'validator_rdx1s078ehp7tdedmvejsxa0efzy0f8pwdkgf7x59cadkqgr0ll8px433n',
                    'validator_rdx1svr5kd8p448kqqmffrg5nztmgdedpns68lfm2382p9l59jjcwvkd20',
                    'validator_rdx1sw22dt4lrvdulpyx6yvxqwfzxklmx9sqzz64tyau0drrxjvx8ysa7u',
                    'validator_rdx1s07kn667akdcry7052ardf2r4lfnkv2k34g2ra5vfc3hwurud38qca',
                    'validator_rdx1s0t8334zzf3dzrkpk4we48qfn9qqt2xkjwzx8u4pkwe0442pp3tenu'
                ];

                if (FOUNDATION_NODES.includes(address)) {
                    t.push('Foundation');
                }

                return t;
            })(),
            totalStakeXRD: delegatedStake,
            feePercent: nominalFee,
            uptimePercent: roundTo(recentUptimePct, 4),
            apy: apyProjection,
            ownerStake: ownerDelegation,
            proposalsMade: totalProposalsMade,
            proposalsMissed: totalProposalsMissed,
        } as Validator;
    });

    // Compute rank and delegatedStakePercent
    validators.sort((a, b) => b.delegatedStake - a.delegatedStake);

    // Group by provider and country to compute shares
    const providerStakeMap = new Map<string, number>();
    const countryStakeMap = new Map<string, number>();

    validators.forEach(v => {
        if (v.provider) providerStakeMap.set(v.provider, (providerStakeMap.get(v.provider) || 0) + v.delegatedStake);
        if (v.country) countryStakeMap.set(v.country, (countryStakeMap.get(v.country) || 0) + v.delegatedStake);
    });

    validators.forEach((v, i) => {
        v.rank = i + 1;
        v.delegatedStakePercent = totalGlobalStake > 0 ? roundTo((v.delegatedStake / totalGlobalStake) * 100, 4) : 0;

        if (v.provider) {
            v.providerPercent = totalGlobalStake > 0 ? roundTo((providerStakeMap.get(v.provider)! / totalGlobalStake) * 100, 2) : 0;
        }
        if (v.country) {
            v.countryPercent = totalGlobalStake > 0 ? roundTo((countryStakeMap.get(v.country)! / totalGlobalStake) * 100, 2) : 0;
        }
    });

    return {
        validators,
        ledgerState: {
            epoch:                      currentStatus.ledger_state.epoch,
            state_version:              currentStatus.ledger_state.state_version,
            round:                      (currentStatus.ledger_state as unknown as { round?: number }).round,
            proposer_round_timestamp:   (currentStatus.ledger_state as unknown as { proposer_round_timestamp?: string }).proposer_round_timestamp,
        },
    };
}

/**
 * Compute network stats from pre-fetched validators.
 * Accepts validators to avoid redundant API calls.
 */
export function computeNetworkStats(
    validators: Validator[],
    epoch: number,
    stateVersion?: number,
    round?: number,
    timestamp?: string
): NetworkStats {
    const totalStaked = validators.reduce((sum, v) => sum + v.delegatedStake, 0);
    const activeValidators = validators.filter(v => v.status === 'active');
    const avgApy = activeValidators.length > 0
        ? activeValidators.reduce((sum, v) => sum + v.apy, 0) / activeValidators.length
        : 0;
    const avgUptime = activeValidators.length > 0
        ? activeValidators.reduce((sum, v) => sum + v.uptimePercent, 0) / activeValidators.length
        : 0;

    return {
        totalStaked: roundTo(totalStaked, 4),
        activeValidators: activeValidators.length,
        totalValidators: validators.length,
        avgApy: roundTo(avgApy, 4),
        avgUptime: roundTo(avgUptime, 4),
        epoch,
        stateVersion,
        round,
        timestamp
    };
}

// ── Centralized Cache Wrapper ──────────────────────────────────────────────
const getRedisClient = () => {
    try {
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            const client = Redis.fromEnv();
            logger.info('[ValidatorsService] Upstash Redis client initialized successfully');
            return client;
        } else {
            logger.warn('[ValidatorsService] Upstash Redis environment variables are missing (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)');
        }
    } catch (e) {
        logger.error({ err: e }, '[ValidatorsService] Failed to initialize Upstash Redis');
    }
    return null;
};

/**
 * Cached validator data with Anti-Garbage protection.
 * Uses unstable_cache as primary caching layer and Upstash Redis as an absolute fallback
 * when the Radix API fails or returns an empty validator list.
 */
export const getValidatorsCached = (network: Network = 'mainnet') =>
    unstable_cache(
        async () => {
            const redis = getRedisClient();
            const backupKey = `radix_validators_${network}_backup`;

            try {
                // Step 2 & 3: Consult API and validate
                const { validators, ledgerState } = await fetchValidatorsWithLedger(network);
                
                // SECURITY: Anti-Garbage protection.
                if (!validators || validators.length === 0) {
                    throw new Error(`Gateway returned empty validator set for ${network}`);
                }

                const result = {
                    validators,
                    networkStats: computeNetworkStats(
                        validators,
                        ledgerState.epoch,
                        ledgerState.state_version,
                        ledgerState.round,
                        ledgerState.proposer_round_timestamp,
                    ),
                };

                // Step 4: Backup to Storage
                if (redis) {
                    redis.set(backupKey, result)
                        .then(() => logger.info({ network }, `[ValidatorsService] Successfully saved validator backup to Upstash Redis under key: ${backupKey}`))
                        .catch(e => logger.error({ err: e }, `[ValidatorsService] Failed to update Redis backup for ${network}`));
                }

                return result;
            } catch (error) {
                // Step 5: Fallback to Storage
                logger.warn({ network, error: String(error) }, '[ValidatorsService] API query failed. Attempting Redis fallback.');
                
                if (redis) {
                    try {
                        const fallbackData = await redis.get<{ validators: Validator[], networkStats: NetworkStats | null }>(backupKey);
                        if (fallbackData && fallbackData.validators && fallbackData.validators.length > 0) {
                            logger.info({ network }, '[ValidatorsService] Successfully retrieved valid fallback data from Redis');
                            return fallbackData;
                        }
                    } catch (redisError) {
                        logger.error({ err: redisError }, '[ValidatorsService] Redis fallback failed');
                    }
                }
                
                // Fallback absolutely empty to avoid UI crash
                logger.error({ network }, '[ValidatorsService] All fallback strategies failed. Returning empty system.');
                return { validators: [], networkStats: null };
            }
        },
        [`validators-${network}`],
        { revalidate: 300, tags: ['validators', `validators-${network}`] },
    )();
