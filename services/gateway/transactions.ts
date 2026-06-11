/**
 * services/gateway/transactions.ts
 *
 * Gateway API calls for transaction streaming, searching, and details.
 * Used by: app/api/transactions, app/api/stake-history, dashboard feature.
 *
 * Date filtering strategy:
 *   The Radix Gateway natively supports `from_ledger_state.timestamp` and
 *   `at_ledger_state.timestamp` in streamTransactions. We pass these params
 *   directly so the Gateway returns only transactions in the requested date
 *   window — no client-side pagination loop required.
 *
 *   Tags that have no Gateway equivalent (e.g. "With Message", "With NFTs")
 *   are still filtered client-side after the native date window narrows
 *   the result set.
 */

import { getGateway, withRetry, type Network } from './client';
import { getXrdAddress } from '@/features/dashboard/explorador/constants';
import logger from '@/lib/logger';
import { revalidateTag, cacheTag, cacheLife } from 'next/cache';
import type { TransactionInfo, StakeHistoryEntry, ValidatorOp, Validator } from '@/types/radix';
import { matchesTransactionTag } from '@/features/dashboard/explorador/utils/filterUtils';
import { resolveProposerFromReceipt, type ReceiptLike } from '@/features/dashboard/explorador/utils/proposerUtils';
import { after } from 'next/server';
import { getRedis } from '@/lib/redis';
import { isValidAddressForNetwork } from '@/utils/apiValidation';


/**
 * Helper to initialize Upstash Redis client.
 */


// ── Opaque Gateway response types ────────────────────────────────────────────
type GatewayField = {
    value?: string;
    name?: string;
    kind?: string;
    field_name?: string;
    fields?: Array<{ kind: string; value: string; field_name: string }>;
};
type GatewayEvent = {
    name?: string;
    emitter?: { entity?: { entity_address?: string } };
    emitter_address?: string;
    data?: {
        fields?: GatewayField[];
        programmatic_json?: { fields: GatewayField[] };
    };
};
type GatewayItem = {
    fee_paid?: string;
    affected_global_entities?: string[];
    receipt?: {
        status?: string;
        events?: GatewayEvent[];
        state_updates?: { updated_substates?: unknown[] };
        fee_destination?: { to_proposer?: string | { xrd_amount?: string } };
    };
    balance_changes?: {
        fungible_balance_changes?: Array<{ resource_address: string; entity_address: string; balance_change: string }>;
        non_fungible_balance_changes?: unknown[];
    };
    intent_hash?: string;
    transaction_hash?: string;
    state_version?: number;
    confirmed_at?: string;
    round_timestamp?: string;
    message?: { content?: { value?: string } };
    epoch?: number;
    round?: number;
    manifest_classes?: string[];
    round_update_transaction?: unknown;
};
type BalanceChange = { resource_address: string; entity_address: string; balance_change: string };

// ── Global stake-history caching is now handled by Next.js Data Cache ────────

// ─────────────────────────────────────────────────────────────────────────────
// Shared opt-ins used by all streamTransactions calls
// ─────────────────────────────────────────────────────────────────────────────
const STREAM_OPT_INS = {
    affected_global_entities: true,
    balance_changes: true,
    receipt_events: true,
    confirmed_at: true,
    receipt_state_changes: true,
    receipt_fee_destination: true,
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// localToUTC
//
// Converts a local date/time in a given IANA timezone to a UTC Date.
// Uses Intl.DateTimeFormat to resolve the real offset for the specific
// date, automatically handling DST (e.g. Europe/Madrid is UTC+1 in
// winter and UTC+2 in summer).
const _tzFmtCache = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneFormatter(timezone: string): Intl.DateTimeFormat {
    const cached = _tzFmtCache.get(timezone);
    if (cached) return cached;
    const I = Intl;
    const fmt = new I.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
    _tzFmtCache.set(timezone, fmt);
    return fmt;
}

// ─────────────────────────────────────────────────────────────────────────────
function localToUTC(
    dateStr: string,
    hours: number,
    minutes: number,
    seconds: number,
    ms: number,
    timezone: string,
): Date {
    const [year, month, day] = dateStr.split('-').map(Number);

    // Treat the desired local time as if it were UTC (our "guess")
    const guessEpoch = Date.UTC(year, month - 1, day, hours, minutes, seconds);
    const guess = new Date(guessEpoch);

    // Format this UTC instant in the target timezone to see what
    // local time it actually maps to
    const fmt = getTimeZoneFormatter(timezone);

    const p: Record<string, string> = {};
    for (const { type, value } of fmt.formatToParts(guess)) p[type] = value;

    const actualLocalEpoch = Date.UTC(
        Number(p.year), Number(p.month) - 1, Number(p.day),
        Number(p.hour === '24' ? '0' : p.hour), Number(p.minute), Number(p.second),
    );

    // offsetMs = how far ahead local time is from UTC at this instant.
    // For UTC+2: guess 00:00Z → local 02:00 → offset = +2h.
    const offsetMs = actualLocalEpoch - guessEpoch;

    // UTC for "desired local time" = desiredLocalAsUTC − offset.
    // Add ms separately (Intl has only second-level precision).
    return new Date(guessEpoch + ms - offsetMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// buildLedgerDateParams
//
// Translates YYYY-MM-DD strings into the Gateway's ledger state selectors.
// Each boundary is converted independently to UTC using the IANA timezone,
// so DST transitions are correctly handled even when start and end fall
// on different sides of a clock change.
//
// - `from_ledger_state.timestamp` = start of the start day (00:00:00.000 local → UTC)
// - `at_ledger_state.timestamp`   = end of the end day   (23:59:59.999 local → UTC)
// ─────────────────────────────────────────────────────────────────────────────
function buildLedgerDateParams(
    start?: string | null,
    end?: string | null,
    timezone = 'UTC',
): {
    from_ledger_state?: { timestamp: Date };
    at_ledger_state?: { timestamp: Date };
} {
    const params: {
        from_ledger_state?: { timestamp: Date };
        at_ledger_state?: { timestamp: Date };
    } = {};

    if (start) {
        params.from_ledger_state = {
            timestamp: localToUTC(start, 0, 0, 0, 0, timezone),
        };
    }

    if (end) {
        params.at_ledger_state = {
            timestamp: localToUTC(end, 23, 59, 59, 999, timezone),
        };
    }

    return params;
}

// ─────────────────────────────────────────────────────────────────────────────
// getDecimalFromFields
//
// Extracts a decimal value from a programmatic-JSON fields array.
// Searches by field name first, then falls back to the first Decimal kind.
// ─────────────────────────────────────────────────────────────────────────────
function getDecimalFromFields(fields: GatewayField[], names: string[]): number {
    const namesSet = new Set(names);
    const f =
        fields.find((x) => namesSet.has(x.field_name as string)) ||
        fields.find((x) => x.kind === 'Decimal');
    return f ? Number(f.value) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseValidatorOpsFromEvents
//
// Parses StakeEvent / UnstakeEvent / ClaimEvent from a receipt events array
// and aggregates per-validator totals. For unstake events it searches nearby
// DepositEvents to recover the expected XRD amount (Radix emits the deposit
// slightly before or after the unstake event).
// ─────────────────────────────────────────────────────────────────────────────
function parseValidatorOpsFromEvents(events: GatewayEvent[]): ValidatorOp[] | undefined {
    const perValidator: Record<string, Omit<ValidatorOp, 'validatorAddress'>> = {};

    for (let ei = 0; ei < events.length; ei++) {
        const ev = events[ei];
        const emitterAddr: string =
            ev.emitter?.entity?.entity_address || ev.emitter_address || '';
        if (!emitterAddr.startsWith('validator_')) continue;

        const evName: string = ev.name || '';
        const data = (ev.data as Record<string, unknown>);
        const progJson = (data?.programmatic_json as Record<string, unknown>) || data;
        const fields: GatewayField[] = (progJson?.fields as GatewayField[]) ?? [];
        const entry = (perValidator[emitterAddr] ??= {});

        if (evName.includes('StakeEvent')) {
            entry.stakeXrd =
                (entry.stakeXrd ?? 0) + getDecimalFromFields(fields, ['xrd_staked', 'amount']);
        } else if (evName.includes('UnstakeEvent')) {
            entry.unstakeLsu =
                (entry.unstakeLsu ?? 0) + getDecimalFromFields(fields, ['stake_units', 'amount']);

            // The XRD DepositEvent for unstake is emitted shortly before/after.
            // Search a ±10 event window to find it.
            const findXrdDeposit = (indices: number[]): boolean => {
                for (const j of indices) {
                    const dep = events[j];
                    if (!dep?.name?.includes('DepositEvent')) continue;
                    const depFields: GatewayField[] =
                        ((dep as Record<string, unknown>).data as Record<string, unknown>)?.fields as GatewayField[] ?? [];
                    const xrd = depFields.find(
                        (x) =>
                            (x.field_name === 'amount' || x.kind === 'Decimal') &&
                            Number(x.value) > 1,
                    );
                    if (xrd) {
                        entry.unstakeXrdExpected =
                            (entry.unstakeXrdExpected ?? 0) + Number(xrd.value);
                        return true;
                    }
                }
                return false;
            };

            const back = Array.from({ length: 10 }, (_, k) => ei - k - 1).filter(k => k >= 0);
            const fwd = Array.from({ length: 10 }, (_, k) => ei + k + 1).filter(
                k => k < events.length,
            );
            if (!findXrdDeposit(back)) findXrdDeposit(fwd);
        } else if (evName.includes('ClaimXrdEvent') || evName.includes('ClaimEvent')) {
            entry.claimXrd =
                (entry.claimXrd ?? 0) +
                getDecimalFromFields(fields, ['claimed_xrd', 'amount']);
        }
    }

    const ops = Object.entries(perValidator).map(([addr, op]) => ({
        validatorAddress: addr,
        ...op,
    }));
    return ops.length > 0 ? ops : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveProposerInfoFromGatewayItem
//
// Delegates to the shared algorithm in proposerUtils.ts.
// Converts the result to undefined (instead of null) to match the optional
// TransactionInfo.proposerInfo field convention.
// ─────────────────────────────────────────────────────────────────────────────
function resolveProposerInfoFromGatewayItem(item: GatewayItem): { validatorIndex: number; rank: number; rewardAmount: string } | undefined {
    return resolveProposerFromReceipt(item.receipt as ReceiptLike) ?? undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseTransactionItem
//
// Converts a raw Gateway transaction item into a typed TransactionInfo.
// Optionally resolves validator-specific stakeXrd/unstakeXrd/claimXrd amounts
// when the caller is interested in a specific validator address.
// ─────────────────────────────────────────────────────────────────────────────
function parseTransactionItem(item: GatewayItem, validatorAddress?: string, network: Network = 'mainnet'): TransactionInfo {
    const feeString: string = item.fee_paid || '0';
    const entities: string[] = Array.isArray(item.affected_global_entities)
        ? item.affected_global_entities
        : [];
    const events: GatewayEvent[] = ((item.receipt as Record<string, unknown>)?.events as GatewayEvent[]) || [];
    const proposerInfo = resolveProposerInfoFromGatewayItem(item);

    // ── Validator-specific staking amounts (only when requested) ──
    let stakeXrd: number | undefined;
    let unstakeXrd: number | undefined;
    let claimXrd: number | undefined;

    if (validatorAddress) {
        let stakeFromEvents = 0;
        let unstakeFromEvents = 0;
        let claimFromEvents = 0;

        for (const ev of events) {
            const emitterAddr =
                ev.emitter?.entity?.entity_address || ev.emitter_address;
            if (emitterAddr && emitterAddr !== validatorAddress) continue;

            const data = (ev.data?.programmatic_json || ev.data) as { fields?: GatewayField[] };
            if (!data?.fields) continue;

            const name: string = ev.name || '';
            if (name.includes('StakeEvent')) {
                stakeFromEvents += getDecimalFromFields(data.fields, [
                    'xrd_staked', 'amount', 'staked_xrd',
                ]);
            } else if (name.includes('UnstakeEvent')) {
                unstakeFromEvents += getDecimalFromFields(data.fields, [
                    'stake_units', 'amount', 'unstaked_xrd',
                ]);
            } else if (name.includes('ClaimXrdEvent') || name.includes('ClaimEvent')) {
                claimFromEvents += getDecimalFromFields(data.fields, [
                    'claimed_xrd', 'amount', 'claimed_amount',
                ]);
            }
        }

        if (stakeFromEvents > 0 || unstakeFromEvents > 0 || claimFromEvents > 0) {
            stakeXrd = stakeFromEvents || undefined;
            unstakeXrd = unstakeFromEvents || undefined;
            claimXrd = claimFromEvents || undefined;
        } else {
            // Fallback: derive amounts from fungible balance changes
            const changes: BalanceChange[] = ((item.balance_changes as Record<string, unknown>)?.fungible_balance_changes as BalanceChange[]) || [];
            let stakeBC = 0;
            let outflowBC = 0;
            for (const c of changes) {
                if (
                    c.resource_address === getXrdAddress(network) &&
                    c.entity_address === validatorAddress
                ) {
                    const delta = Number(c.balance_change);
                    if (delta > 0) stakeBC += delta;
                    else outflowBC += Math.abs(delta);
                }
            }
            if (stakeBC > 0) stakeXrd = stakeBC;
            if (outflowBC > 0) claimXrd = outflowBC;
        }
    }

    // ── Parse all validator ops from events ──
    const validatorOps = parseValidatorOpsFromEvents(events);

    // ── ProtocolVote detection ──
    const hasProtocolVote = events.some(
        (e) => e.name === 'ProtocolUpdateReadinessSignalEvent',
    );
    const rawClasses: string[] = item.manifest_classes ?? [];
    const manifestClasses =
        hasProtocolVote && !rawClasses.includes('ProtocolVote')
            ? ['ProtocolVote', ...rawClasses]
            : rawClasses;

    // ── Calculate dominant asset transfer for summary ──
    const fungibleChanges: BalanceChange[] = ((item.balance_changes as Record<string, unknown>)?.fungible_balance_changes as BalanceChange[]) || [];
    const resourceTotals: Record<string, number> = {};

    // Group positive changes (inflows) by resource to find total volume moved
    fungibleChanges.forEach(c => {
        const amount = Number(c.balance_change);
        if (amount > 0) {
            resourceTotals[c.resource_address] = (resourceTotals[c.resource_address] || 0) + amount;
        }
    });

    const xrdAddress = getXrdAddress(network);
    let displayAmount: number | undefined;
    let displayResource: string | undefined;
    let displayIsXrd = false;
    let displayIsMint = false;
    let displayResourceName: string | undefined;

    // ── 1. XRD Priority ──
    if (resourceTotals[xrdAddress]) {
        displayAmount = resourceTotals[xrdAddress];
        displayResource = 'XRD';
        displayIsXrd = true;
        displayIsMint = false;
    } else {
        // ── 2. Analyze events for specialized types (Minting) ──
        const mintEvent = events.find(e =>
            e.name === 'MintFungibleResourceEvent' ||
            e.name === 'MintNonFungibleResourceEvent' ||
            e.name?.includes('MintResource')
        );

        if (mintEvent) {
            displayIsMint = true;
            // Resource address comes from the event emitter (the resource being minted)
            const mintEmitter = mintEvent.emitter?.entity?.entity_address || mintEvent.emitter_address || '';
            if (mintEmitter && mintEmitter.startsWith('resource_')) {
                displayResource = mintEmitter;
                displayIsXrd = displayResource === xrdAddress;
                displayResourceName = displayIsXrd ? 'XRD' : undefined;
            }
            // Amount: Gateway MintFungibleResourceEvent data is a Decimal value
            const data = mintEvent.data?.programmatic_json || mintEvent.data;
            if (data) {
                // Direct Decimal kind (most common)
                const rawData = data as unknown as { kind?: string; value?: string; fields?: GatewayField[] };
                if (rawData.kind === 'Decimal' && rawData.value) {
                    displayAmount = Number(rawData.value);
                } else if (rawData.fields) {
                    // Fallback: structured with fields
                    const amountField = rawData.fields.find(f => f.kind === 'Decimal' || f.field_name === 'amount');
                    if (amountField?.value) {
                        displayAmount = Number(amountField.value);
                    }
                }
            }
        }

        // ── 3. Fallback to highest volume token ──
        if (!displayIsMint) {
            let maxToken: string | undefined;
            let maxVal = 0;
            for (const [res, total] of Object.entries(resourceTotals)) {
                if (total > maxVal) {
                    maxVal = total;
                    maxToken = res;
                }
            }
            if (maxToken) {
                displayAmount = maxVal;
                displayResource = maxToken;
                displayIsXrd = false;
            }
        }
    }

    return {
        intentHash:
            item.intent_hash ||
            item.transaction_hash ||
            item.state_version?.toString() ||
            '',
        status: item.receipt?.status || 'Committed',
        feePaid: Number(feeString),
        confirmedAt:
            item.confirmed_at || item.round_timestamp
                ? new Date((item.confirmed_at || item.round_timestamp) as string)
                : new Date(),
        stateVersion: item.state_version || 0,
        message: item.message?.content?.value || undefined,
        epoch: item.epoch || 0,
        round: item.round || 0,
        accountsCount: entities.filter((e: string) => e.startsWith('account_')).length,
        componentsCount: entities.filter((e: string) => e.startsWith('component_')).length,
        hasNfts:
            (item.balance_changes?.non_fungible_balance_changes?.length ?? 0) > 0 ||
            entities.some((e: string) => e.startsWith('resource_') && e.includes(':')),
        manifestClasses,
        validatorAddress:
            entities.find((e: string) => typeof e === 'string' && e.startsWith('validator_')) ??
            undefined,
        validatorOps,
        displayAmount,
        displayResource,
        displayIsXrd,
        displayIsMint,
        displayResourceName,
        proposerInfo,
        balanceChanges: item.balance_changes as Record<string, unknown> | undefined,
        ...(validatorAddress && { stakeXrd, unstakeXrd, claimXrd }),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchRecentTransactions
//
// Streams the most recent transactions from the ledger tip.
// Optionally scoped to a date window via native Gateway timestamp selectors.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchRecentTransactions(
    cursor?: string,
    limit = 15,
    network: Network = 'mainnet',
    dateRange?: { start?: string | null; end?: string | null; timezone?: string },
): Promise<{ transactions: TransactionInfo[]; nextCursor: string | undefined }> {
    const gateway = getGateway(network);
    const dateParams = buildLedgerDateParams(dateRange?.start, dateRange?.end, dateRange?.timezone);

    try {
        const res = await withRetry(() =>
            gateway.stream.innerClient.streamTransactions({
                streamTransactionsRequest: {
                    limit_per_page: limit,
                    cursor,
                    opt_ins: STREAM_OPT_INS as Parameters<typeof gateway.stream.innerClient.streamTransactions>[0]['streamTransactionsRequest']['opt_ins'],
                    ...dateParams,
                },
            }),
        );

        const transactions = (res.items || []).map(item => parseTransactionItem(item as unknown as GatewayItem, undefined, network));

        logger.info({
            network,
            count: transactions.length,
            hasMore: !!res.next_cursor
        }, '[TransactionsService] Recent transactions fetched');

        return {
            transactions,
            nextCursor: res.next_cursor || undefined,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
            { err: error },
            'Error fetching recent txs: %s',
            message,
        );
        throw new Error(`Failed to fetch recent transactions: ${message}`);
    }
}

/**
 * Enriches a list of transactions with basic metadata (names and icons)
 * for the primary resources displayed in the UI.
 * This prevents "hydration flashes" on the client.
 */
export async function enrichTransactionsMetadata(
    transactions: TransactionInfo[],
    network: Network = 'mainnet'
): Promise<TransactionInfo[]> {
    if (!transactions || transactions.length === 0) return transactions;

    // 1. Identify unique resource addresses that need metadata
    const addresses = new Set<string>();
    transactions.forEach(tx => {
        if (tx.displayResource && tx.displayResource !== 'XRD') {
            addresses.add(tx.displayResource);
        }
    });

    if (addresses.size === 0) return transactions;

    // 2. Fetch metadata in batches of 20 (Gateway limit)
    const gateway = getGateway(network);
    const addressList = Array.from(addresses);
    const metadataMap = new Map<string, { name?: string; symbol?: string; icon?: string }>();

    interface GatewayMetadataItem {
        key: string;
        value: { typed: { value: string } };
    }
    interface GatewayEntityItem {
        address: string;
        metadata?: { items: GatewayMetadataItem[] };
    }

    try {
        const res = await withRetry(() =>
            gateway.state.innerClient.stateEntityDetails({
                stateEntityDetailsRequest: {
                    addresses: addressList,
                    opt_ins: {
                        explicit_metadata: ['name', 'symbol', 'icon_url'],
                    }
                }
            })
        );

        (res.items as unknown as GatewayEntityItem[] || []).forEach((item) => {
            const metadata = item.metadata?.items || [];
            const metaByKey = new Map(metadata.map(m => [m.key, m] as const));
            const name = metaByKey.get('name')?.value?.typed?.value;
            const symbol = metaByKey.get('symbol')?.value?.typed?.value;
            const icon = metaByKey.get('icon_url')?.value?.typed?.value;
            metadataMap.set(item.address, { name, symbol, icon });
        });
    } catch (error) {
        logger.error({ err: error, network }, '[TransactionsService] Failed to fetch metadata for enrichment');
        // Non-blocking: if enrichment fails, we return original transactions
        return transactions;
    }

    // 3. Inject metadata into transactions
    return transactions.map(tx => {
        if (tx.displayResource && metadataMap.has(tx.displayResource)) {
            const meta = metadataMap.get(tx.displayResource)!;
            return {
                ...tx,
                displayResourceName: meta.symbol || meta.name || tx.displayResourceName,
                displayResourceIcon: meta.icon,
            };
        }
        return tx;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// enrichTransactionsProposerInfo
//
// Enriches transactions with proposer display data (name, iconUrl, address)
// by reading the validator list from Redis backup. This centralizes the
// enrichment at the service layer so page.tsx does not need to rebuild a
// lookup map on every request.
//
// Transactions that already have a populated `proposerInfo.name` are skipped.
// ─────────────────────────────────────────────────────────────────────────────
export async function enrichTransactionsProposerInfo(
    transactions: TransactionInfo[],
    network: Network = 'mainnet',
): Promise<TransactionInfo[]> {
    if (!transactions || transactions.length === 0) return transactions;

    // Only proceed if at least one tx has proposerInfo without a name
    const needsEnrichment = transactions.some(tx => tx.proposerInfo && !tx.proposerInfo.name);
    if (!needsEnrichment) return transactions;

    const redis = getRedis();
    if (!redis) return transactions;

    try {
        const backupKey = `radix_validators_${network}_backup`;
        const validatorData = await redis.get<{
            validators: Validator[];
        }>(backupKey);

        if (!validatorData?.validators?.length) return transactions;

        // Build a fast lookup map: rank → { name, iconUrl, address }
        const proposerLookup = new Map<number, { name: string; iconUrl: string; address: string }>();
        for (const v of validatorData.validators) {
            if (v.rank > 0) {
                proposerLookup.set(v.rank, {
                    name: v.name,
                    iconUrl: v.iconUrl || '',
                    address: v.address,
                });
            }
        }

        let enrichedCount = 0;
        transactions.forEach(tx => {
            if (tx.proposerInfo && !tx.proposerInfo.name) {
                const entry = proposerLookup.get(tx.proposerInfo.rank);
                if (entry) {
                    tx.proposerInfo.name = entry.name;
                    tx.proposerInfo.iconUrl = entry.iconUrl;
                    tx.proposerInfo.address = entry.address;
                    enrichedCount++;
                }
            }
        });

        if (enrichedCount > 0) {
            logger.info(
                { network, enrichedCount },
                '[TransactionsService] Proposer info enriched from Redis validator backup',
            );
        }
    } catch (error) {
        logger.error(
            { err: error, network },
            '[TransactionsService] Failed to enrich proposer info — non-blocking',
        );
    }

    return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchTransactionDetails
//
// Fetches the full committed transaction details for a given intent hash.
// Returns the raw Gateway item used by both /api/transactions/[hash] and
// the txid_ fast-path in searchTransactionsByAddress.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchTransactionDetails(
    hash: string,
    network: Network = 'mainnet',
): Promise<unknown | null> {
    "use cache";
    cacheLife("hours");
    cacheTag('transactions', 'tx-details', 'tx-details-base');

    const restBase =
        network === 'stokenet'
            ? 'https://gateway-stokenet.radix.community'
            : 'https://mainnet.radixdlt.com';
    try {
        const res = await withRetry(async () => {
            const r = await fetch(`${restBase}/transaction/committed-details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intent_hash: hash,
                    opt_ins: {
                        receipt_events: true,
                        affected_global_entities: true,
                        balance_changes: true,
                        receipt_fee_summary: true,
                        receipt_fee_source: true,
                        receipt_fee_destination: true,
                        manifest_instructions: true,
                        confirmed_at: true,
                        raw_hex: false,
                        receipt_state_changes: true,
                        receipt_costing_parameters: true,
                        receipt_output: true,
                        detailed_events: true
                    },
                }),
            });
            if (!r.ok)
                throw Object.assign(new Error(`Gateway ${r.status}`), { status: r.status });
            return r.json();
        });
        return res?.transaction ?? null;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
            { err: error },
            'fetchTransactionDetails error: %s',
            message,
        );
        throw new Error(`Failed to fetch transaction details: ${message}`);
    }
}



// ─────────────────────────────────────────────────────────────────────────────
// searchTransactionsByAddress
//
// Streams transactions filtered by an entity address (account, validator,
// component, or txid_…). Accepts an optional date range that is passed
// natively to the Gateway.
// ─────────────────────────────────────────────────────────────────────────────
export async function searchTransactionsByAddress(
    address: string | string[],
    cursor?: string,
    limit = 15,
    network: Network = 'mainnet',
    dateRange?: { start?: string | null; end?: string | null; timezone?: string },
): Promise<{ transactions: TransactionInfo[]; nextCursor: string | undefined }> {
    // Defensive network check: Prevent 400 errors by identifying mismatch before calling Gateway
    const addressToValidate = Array.isArray(address) ? address[0] : address;
    if (addressToValidate && !isValidAddressForNetwork(addressToValidate, network)) {
        logger.warn({ address, network }, '[TransactionsService] Address does not belong to the requested network. Returning empty result.');
        return { transactions: [], nextCursor: undefined };
    }

    // Fast path: a txid_ is a direct detail lookup, not a stream query
    if (typeof address === 'string' && address.startsWith('txid_')) {
        const item = await fetchTransactionDetails(address, network);
        if (!item) return { transactions: [], nextCursor: undefined };
        return {
            transactions: [parseTransactionItem(item as unknown as GatewayItem, undefined, network)],
            nextCursor: undefined,
        };
    }

    const gateway = getGateway(network);
    const isValidator = typeof address === 'string' && address.startsWith('validator_');
    const dateParams = buildLedgerDateParams(dateRange?.start, dateRange?.end, dateRange?.timezone);

    if (Array.isArray(address) && address.length > 1) {
        // Implement OR logic with composite cursors
        let cursors: Record<string, string | undefined> = {};
        if (cursor) {
            try {
                cursors = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
            } catch (_e) {
                logger.warn('Failed to parse composite cursor');
            }
        }

        const fetchPromises = address.map(async (addr) => {
            // If we have a cursor object and this address is explicitly set to null, it means it has reached the end
            if (cursor && cursors[addr] === null) return { addr, transactions: [], nextCursor: null };

            try {
                const isResource = addr.startsWith('resource_');
                const streamTransactionsRequest: Parameters<typeof gateway.stream.innerClient.streamTransactions>[0]['streamTransactionsRequest'] = {
                    limit_per_page: limit,
                    cursor: cursors[addr],
                    opt_ins: STREAM_OPT_INS as Parameters<typeof gateway.stream.innerClient.streamTransactions>[0]['streamTransactionsRequest']['opt_ins'],
                    ...dateParams,
                };
                if (isResource) {
                    streamTransactionsRequest.balance_change_resources_filter = [addr];
                } else {
                    streamTransactionsRequest.affected_global_entities_filter = [addr];
                }

                const res = await withRetry(() =>
                    gateway.stream.innerClient.streamTransactions({
                        streamTransactionsRequest,
                    }),
                );
                const transactions = (res.items || []).map((item) =>
                    parseTransactionItem(item as unknown as GatewayItem, undefined, network)
                );
                return { addr, transactions, nextCursor: res.next_cursor || null };
            } catch (err) {
                logger.error({ err, addr }, 'Error fetching transactions for address in composite');
                return { addr, transactions: [], nextCursor: null };
            }
        });

        const results = await Promise.all(fetchPromises);
        let allTransactions = results.flatMap(r => r.transactions);

        // Deduplicate by intentHash
        const seen = new Set<string>();
        allTransactions = allTransactions.filter(tx => {
            if (seen.has(tx.intentHash)) return false;
            seen.add(tx.intentHash);
            return true;
        });

        // Sort by confirmedAt descending
        allTransactions.sort((a, b) => b.confirmedAt.getTime() - a.confirmedAt.getTime());

        // We fetched 'limit' for EACH address. We only return top 'limit' overall to maintain page size.
        // But doing so strictly requires keeping track of exactly which txs were consumed to generate the right cursors,
        // which is impossible since Gateway cursors are opaque (we can't generate a cursor for the middle of a page).
        // Therefore, we return ALL fetched transactions (up to address.length * limit) 
        // and advance the cursors for ALL addresses that returned data.
        // The frontend will deduplicate and display them.

        const nextCursors: Record<string, string | null> = {};
        let hasMore = false;
        results.forEach(r => {
            nextCursors[r.addr] = r.nextCursor;
            if (r.nextCursor) hasMore = true;
        });

        const compositeCursor = hasMore ? Buffer.from(JSON.stringify(nextCursors)).toString('base64') : undefined;

        logger.info({
            network,
            addressCount: address.length,
            count: allTransactions.length
        }, '[TransactionsService] Composite OR transactions fetched');

        return { transactions: allTransactions, nextCursor: compositeCursor };
    }

    const affectedEntities = Array.isArray(address) ? address : [address];
    const resources = affectedEntities.filter(a => a.startsWith('resource_'));
    const others = affectedEntities.filter(a => !a.startsWith('resource_'));

    try {
        const streamTransactionsRequest: Parameters<typeof gateway.stream.innerClient.streamTransactions>[0]['streamTransactionsRequest'] = {
            limit_per_page: limit,
            cursor,
            opt_ins: STREAM_OPT_INS as Parameters<typeof gateway.stream.innerClient.streamTransactions>[0]['streamTransactionsRequest']['opt_ins'],
            ...dateParams,
        };
        
        if (resources.length > 0) {
            streamTransactionsRequest.balance_change_resources_filter = resources;
        }
        if (others.length > 0) {
            streamTransactionsRequest.affected_global_entities_filter = others;
        }

        const res = await withRetry(() =>
            gateway.stream.innerClient.streamTransactions({
                streamTransactionsRequest,
            }),
        );

        const transactions = (res.items || []).map((item) =>
            parseTransactionItem(item as unknown as GatewayItem, isValidator ? (address as string) : undefined, network),
        );

        logger.info({
            network,
            address: typeof address === 'string' ? address.slice(0, 16) + '...' : address.length + ' addresses',
            count: transactions.length
        }, '[TransactionsService] Transactions by address fetched');

        return { transactions, nextCursor: res.next_cursor || undefined };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
            { err: error },
            'Error fetching txs by address: %s',
            message,
        );
        throw new Error(`Failed to fetch transactions for address(es): ${message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchFilteredTransactions
//
// Entry point for filtered transaction queries. Date ranges are pushed down to
// the Gateway natively via `from_ledger_state`/`at_ledger_state`, so the API
// already returns only transactions within the requested window.
//
// Client-side post-filtering is limited to tags that have no Gateway equivalent
// (With Message, With NFTs). For 'All' we need just one page; for tag-filtered
// queries we may need a few more pages to fill the requested limit.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// fetchFilteredTransactionsRaw
//
// The core logic for filtered transaction queries. Date ranges are pushed down to
// the Gateway natively. Multi-page scanning is used for tags with no Gateway equivalent.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchFilteredTransactionsRaw(options: {
    tag: string;
    start: string | null;
    end: string | null;
    cursor: string | undefined;
    limit: number;
    address: string | string[] | undefined;
    network: Network;
    timezone: string;
}): Promise<{ transactions: TransactionInfo[]; nextCursor: string | undefined }> {
    const { tag, start, end, cursor: initialCursor, limit, address, network, timezone } = options;

    const dateRange = { start, end, timezone };
    const results: TransactionInfo[] = [];
    let currentCursor = initialCursor;
    let pageCount = 0;

    // With native date filtering the Gateway already scopes the window, so
    // we only need extra pages for tags that require client-side matching.
    const MAX_PAGES = tag === 'All' ? 1 : 5;

    while (results.length < limit && pageCount < MAX_PAGES) {
        pageCount++;

        const page = address
            ? await searchTransactionsByAddress(address, currentCursor, 30, network, dateRange)
            : await fetchRecentTransactions(currentCursor, 30, network, dateRange);

        if (page.transactions.length === 0) break;

        const filtered = page.transactions.filter(tx => matchesTransactionTag(tx, tag));
        results.push(...filtered);

        if (!page.nextCursor) {
            currentCursor = undefined;
            break;
        }
        currentCursor = page.nextCursor;
    }

    const finalTxs = results.slice(0, limit);

    return {
        transactions: finalTxs,
        nextCursor:
            results.length >= limit
                ? currentCursor
                : pageCount < MAX_PAGES
                    ? currentCursor
                    : undefined,
    };
}

/**
 * Next.js Data Cache wrapper for filtered transactions.
 */
async function getFilteredTransactionsFromDataCache(
    options: {
        tag: string;
        start: string | null;
        end: string | null;
        cursor: string | undefined;
        limit: number;
        address: string | string[] | undefined;
        network: Network;
        timezone: string;
    },
    backupKey: string
) {
    "use cache";
    cacheLife("minutes");
    cacheTag('transactions', `transactions-${options.network}`);

    logger.info({ tag: options.tag, address: options.address }, '[TransactionsService] Data Cache miss - fetching from API');
    const result = await fetchFilteredTransactionsRaw(options);

    // Seed Redis for SWR
    const redis = getRedis();
    if (backupKey && redis && result.transactions && result.transactions.length > 0) {
        redis.set(backupKey, result).catch(e =>
            logger.error({ err: e }, '[TransactionsService] Failed to seed Redis for filtered query'),
        );
    }

    return result;
}

/**
 * Entry point for filtered transaction queries.
 *
 * Implements SWR (Stale-While-Revalidate) with Redis Persistence:
 * 1. Redis Check: Fast hit for popular filtered views.
 * 2. Background After: Refreshes Redis and Data Cache if stale.
 * 3. Data Cache: Standard Next.js multi-node cache.
 * 4. API Fallback: Gateway scanning (max 5 pages).
 */
export async function fetchFilteredTransactions(options: {
    tag?: string;
    start?: string | null;
    end?: string | null;
    cursor?: string;
    limit?: number;
    address?: string | string[];
    network?: Network;
    timezone?: string;
}): Promise<{ transactions: TransactionInfo[]; nextCursor: string | undefined }> {
    const {
        tag = 'All',
        start = null,
        end = null,
        cursor,
        limit = 15,
        address,
        network = 'mainnet',
        timezone = 'UTC',
    } = options;

    const opParams = { tag, start, end, cursor, limit, address, network, timezone };

    const isGlobalTip = !start && !end && !cursor && !address;

    // Fix: Unify tip limit to 100 to prevent smaller queries from shrinking the cache
    if (isGlobalTip) {
        opParams.limit = 100;
    }

    const hasDateFilter = !!(start || end);

    if (hasDateFilter) {
        // BYPASS ALL CACHES FOR DATE RANGE FILTERING
        // Each date combination is unique — caching would serve stale results
        logger.info({ network, tag, start, end }, '[TransactionsService] Bypassing all caches for calendar filter');
        return fetchFilteredTransactionsRaw(opParams);
    }

    if (!isGlobalTip) {
        // Deep pagination or address search — Data Cache only, no Redis
        logger.info({ network, tag, address, cursor: !!cursor }, '[TransactionsService] Bypassing Redis cache for deep/custom query');
        return getFilteredTransactionsFromDataCache(opParams, '');
    }

    const tagSlug = tag.replace(/\s+/g, '_').toLowerCase();
    const backupKey = `radix_txs_filtered_${network}_${tagSlug}`;

    const redis = getRedis();

    // ── Step 1: Redis Fast Hit ───────────────────────────────────────────────
    if (redis) {
        try {
            const stale = await redis.get<{ transactions: TransactionInfo[]; nextCursor: string; updatedAt?: number }>(backupKey);
            if (stale?.transactions && stale.transactions.length > 0) {
                logger.info({ tag, address, count: stale.transactions.length }, '[TransactionsService] Serving filtered transactions from Redis');

                const now = Date.now();
                const isStale = !stale.updatedAt || (now - stale.updatedAt > REVALIDATION_THRESHOLD);

                if (isStale) {
                    // ── Step 2: Background Revalidation ──────────────────────────
                    after(async () => {
                        try {
                            const fresh = await fetchFilteredTransactionsRaw(opParams);
                            if (fresh.transactions && fresh.transactions.length > 0) {
                                await redis.set(backupKey, { ...fresh, updatedAt: Date.now() });
                                revalidateTag(`transactions-${network}`, 'max');
                                logger.info({ tag, network }, '[TransactionsService] Background filter revalidation complete');
                            }
                        } catch (bgErr) {
                            logger.error({ err: bgErr, tag }, '[TransactionsService] Background filter revalidation failed');
                        }
                    });
                }

                return stale;
            }
        } catch (e) {
            logger.error({ err: e }, '[TransactionsService] Redis filter read failed');
        }
    }

    // ── Step 3: Data Cache / API Scanning ────────────────────────────────────
    return getFilteredTransactionsFromDataCache(opParams, backupKey);
}


// ─────────────────────────────────────────────────────────────────────────────
// fetchStakeHistoryRaw
//
// Aggregates 90 days of stake/unstake/claim activity for a validator directly
// from the Gateway API. This is a heavy operation (up to 20 API pages).
// Used exclusively by the background Cron worker.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchStakeHistoryRaw(
    validatorAddress: string,
    network: Network = 'mainnet',
): Promise<StakeHistoryEntry[]> {
    if (!isValidAddressForNetwork(validatorAddress, network)) {
        logger.warn({ validatorAddress, network }, '[TransactionsService] Validator address mismatch for network in Raw Fetch');
        return [];
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    // Pre-fill every day so days with no activity still appear in the chart
    const dailyMap = new Map<string, { stake: number; unstake: number; claim: number }>();
    for (let i = 0; i < 90; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap.set(d.toISOString().split('T')[0], { stake: 0, unstake: 0, claim: 0 });
    }

    const startDate = ninetyDaysAgo.toISOString().split('T')[0];
    let cursor: string | undefined;
    let done = false;
    let pageCount = 0;
    const MAX_PAGES = 20;

    const fetchHistoryPages = async (currCursor: string | undefined, count: number): Promise<void> => {
        if (done || count >= MAX_PAGES) {
            pageCount = count;
            return;
        }
        const page = await searchTransactionsByAddress(
            validatorAddress,
            currCursor,
            100,
            network,
            { start: startDate },
        );

        for (const tx of page.transactions) {
            const confirmedAt =
                tx.confirmedAt instanceof Date ? tx.confirmedAt : new Date(tx.confirmedAt);
            if (confirmedAt < ninetyDaysAgo) { done = true; break; }

            const dateStr = confirmedAt.toISOString().split('T')[0];
            const day = dailyMap.get(dateStr);
            if (!day) continue;

            if (tx.stakeXrd) day.stake += tx.stakeXrd;
            if (tx.unstakeXrd) day.unstake += tx.unstakeXrd;
            if (tx.claimXrd) day.claim += tx.claimXrd;
        }

        if (!page.nextCursor) done = true;
        else await fetchHistoryPages(page.nextCursor, count + 1);
    };
    await fetchHistoryPages(cursor, 0);

    // If we reached the page limit without finishing, it's an incomplete history.
    // Throw to avoid caching a partial state.
    if (pageCount >= MAX_PAGES) {
        throw new Error(`Failed to fetch full history for ${validatorAddress} (max pages reached)`);
    }

    return Array.from(dailyMap.entries())
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date));
}


// ─────────────────────────────────────────────────────────────────────────────
// StakeHistoryRecord
//
// Extended format that is persisted in Redis instead of the flat array.
// Stores the data + metadata required for incremental sync.
// Backward compatible: fetchStakeHistoryCached detects whether what is in Redis
// is the old format (flat array) or the new one (object with .data).
// ─────────────────────────────────────────────────────────────────────────────
export interface StakeHistoryRecord {
    /** 90 days of history, ordered from oldest to most recent */
    data: StakeHistoryEntry[];
    /** Date of the most recent processed day (YYYY-MM-DD) */
    lastSyncedDate: string;
    /** Unix timestamp (ms) of the last time the sync was executed */
    lastSyncedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchStakeHistoryIncremental
//
// Incremental version of fetchStakeHistoryRaw. Instead of refetching the
// full 90 days, it only requests transactions from the day after the
// last sync. It merges with the existing history and slides the 90-day
// window by removing expired days.
//
// Result: from up to 20 HTTP pages per execution down to 1–2 pages in the
// normal case (cron running daily).
//
// Automatic fallback to fetchStakeHistoryRaw if:
//   - No previous data exists
//   - Data has not been updated for more than FULL_REFRESH_DAYS days
//   - Incremental fails for any reason
// ─────────────────────────────────────────────────────────────────────────────
const FULL_REFRESH_DAYS = 3; // If the last sync was more than 3 days ago, do a full refetch
const WINDOW_DAYS = 90;

export async function fetchStakeHistoryIncremental(
    validatorAddress: string,
    existing: StakeHistoryRecord | null,
    network: Network = 'mainnet',
): Promise<StakeHistoryRecord> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // ── Decide whether to perform a full refresh or incremental ───────────────
    const needsFullRefresh = (() => {
        if (!existing || !existing.lastSyncedDate || !existing.data?.length) return true;
        const lastSync = new Date(existing.lastSyncedDate);
        const daysSinceSync = Math.floor((today.getTime() - lastSync.getTime()) / 86_400_000);
        return daysSinceSync > FULL_REFRESH_DAYS;
    })();

    if (needsFullRefresh) {
        const data = await fetchStakeHistoryRaw(validatorAddress, network);
        return { data, lastSyncedDate: todayStr, lastSyncedAt: Date.now() };
    }

    // ── Incremental sync: only fetch new days ────────────────────────────────
    const lastSyncedDate = existing!.lastSyncedDate;

    // If already up to date, nothing to do
    if (lastSyncedDate >= todayStr) {
        return { ...existing!, lastSyncedAt: Date.now() };
    }

    // startDate = day after the last processed sync
    const startDt = new Date(lastSyncedDate);
    startDt.setDate(startDt.getDate() + 1);
    const startDate = startDt.toISOString().split('T')[0];

    // Pre-fill new days with zeros
    const newDailyMap = new Map<string, { stake: number; unstake: number; claim: number }>();
    const tempDt = new Date(startDt);
    while (tempDt <= today) {
        newDailyMap.set(tempDt.toISOString().split('T')[0], { stake: 0, unstake: 0, claim: 0 });
        tempDt.setDate(tempDt.getDate() + 1);
    }

    // Paginate the Gateway only from startDate (usually 1–2 pages)
    let cursor: string | undefined;
    let done = false;
    const MAX_PAGES = 5; // For incremental, 5 pages is more than enough; if exceeded, something went wrong

    const fetchHistoryPagesIncremental = async (currCursor: string | undefined, count: number): Promise<void> => {
        if (done || count >= MAX_PAGES) {
            return;
        }
        const page = await searchTransactionsByAddress(
            validatorAddress,
            currCursor,
            100,
            network,
            { start: startDate },
        );

        for (const tx of page.transactions) {
            const confirmedAt = tx.confirmedAt instanceof Date ? tx.confirmedAt : new Date(tx.confirmedAt);
            if (confirmedAt < startDt) { done = true; break; }

            const dateStr = confirmedAt.toISOString().split('T')[0];
            const day = newDailyMap.get(dateStr);
            if (!day) continue;

            if (tx.stakeXrd) day.stake += tx.stakeXrd;
            if (tx.unstakeXrd) day.unstake += tx.unstakeXrd;
            if (tx.claimXrd) day.claim += tx.claimXrd;
        }

        if (!page.nextCursor) done = true;
        else await fetchHistoryPagesIncremental(page.nextCursor, count + 1);
    };
    await fetchHistoryPagesIncremental(cursor, 0);

    // ── Merge: combine existing history with new days ─────────────────────────
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() - (WINDOW_DAYS - 1));
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Filter historical days that are still within the 90-day window
    const filtered = existing!.data.filter(e => e.date >= cutoffStr);

    // Add new days
    const newEntries = Array.from(newDailyMap.entries())
        .map(([date, vals]) => ({ date, ...vals }));

    // Merge and sort
    const merged = [...filtered, ...newEntries]
        .sort((a, b) => a.date.localeCompare(b.date));

    // Deduplicate just in case (same day appears in both filtered and newEntries)
    const seen = new Set<string>();
    const deduped = merged.filter(e => {
        if (seen.has(e.date)) return false;
        seen.add(e.date);
        return true;
    });

    return {
        data: deduped,
        lastSyncedDate: todayStr,
        lastSyncedAt: Date.now(),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchStakeHistoryCached
//
// Reads the 90-day stake history directly from Upstash Redis, yielding an
// instant sub-20ms response time. Used by the Frontend UI.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchStakeHistoryCached(
    validatorAddress: string,
    network: Network = 'mainnet',
): Promise<StakeHistoryEntry[]> {
    if (!isValidAddressForNetwork(validatorAddress, network)) {
        logger.warn({ validatorAddress, network }, '[TransactionsService] Validator address mismatch for network in Cached Fetch');
        return [];
    }

    const redis = getRedis();
    const historyMap = `stake_history_map_${network}`;

    if (!redis) return [];

    try {
        const raw = await redis.hget<StakeHistoryRecord>(historyMap, validatorAddress);

        if (raw) {
            // New format: { data, lastSyncedDate, lastSyncedAt }
            if (typeof raw === 'object' && !Array.isArray(raw) && 'data' in raw) {
                return (raw as StakeHistoryRecord).data;
            }
            // Old format: flat array (fallback for transition)
            if (Array.isArray(raw)) return raw;
            // Serialized string (old format)
            if (typeof raw === 'string') return JSON.parse(raw);
        }
    } catch (e) {
        logger.error({ err: e, validatorAddress }, '[TransactionsService] Failed to read stake history from Redis');
    }

    logger.warn({ validatorAddress }, '[TransactionsService] Stake history missing in Redis. Falling back to heavy Gateway fetch.');
    return fetchStakeHistoryRaw(validatorAddress, network);
}
// ─────────────────────────────────────────────────────────────────────────────
// fetchRoundProposer
//
// Looks up the validator that proposed a specific epoch/round combination.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchRoundProposer(
    epoch: number,
    round: number,
    stateVersion: number,
    network: Network = 'mainnet',
): Promise<string | null> {
    const gateway = getGateway(network);
    try {
        const res = await gateway.stream.innerClient.streamTransactions({
            streamTransactionsRequest: {
                at_ledger_state: { state_version: stateVersion },
                limit_per_page: 30,
                order: 'Desc',
                opt_ins: { receipt_events: true } as Parameters<typeof gateway.stream.innerClient.streamTransactions>[0]['streamTransactionsRequest']['opt_ins'],
            },
        });

        for (const item of res.items || []) {
            if (item.epoch === epoch && item.round === round) {
                const raw = item as GatewayItem;
                if ((raw.round_update_transaction as Record<string, string>)?.proposer_address) {
                    return (raw.round_update_transaction as Record<string, string>).proposer_address;
                }
            }
        }
        return null;
    } catch (error) {
        logger.error(
            { err: error },
            'Error fetching round proposer: %s',
            error instanceof Error ? error.message : String(error),
        );
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache Constants
// ─────────────────────────────────────────────────────────────────────────────
const REVALIDATION_THRESHOLD = 1 * 60 * 1000; // 1 minute



/**
 * Cached version of fetchRecentTransactions (Data Cache).
 *
 * SWR (Stale-While-Revalidate) pattern for the initial tip load:
 *   1. Vercel Data Cache ("use cache") — instant if warm.
 *   2. Upstash Redis (Storage) — fast return of stale data, then
 *      background API refresh via after().
 *   3. Radix Gateway API (blocking cold-start) — first ever load.
 *   4. Absolute Fallback — returns empty state to prevent UI crash.
 *
 * Paginated queries (cursor != null) always go to the API directly
 * since they cannot be meaningfully cached in Storage.
 */
async function getRecentTransactionsFromDataCache(
    cursor: string | undefined,
    limit: number,
    network: Network
) {
    "use cache";
    cacheLife("minutes");
    cacheTag('transactions', `transactions-${network}`);

    const isTip = !cursor;
    const rawResult = await fetchRecentTransactions(cursor, limit, network);
    const result = isTip
        ? await enrichTransactionsMetadata(rawResult.transactions, network)
            .then(enriched => enrichTransactionsProposerInfo(enriched, network))
            .then(enriched => ({ ...rawResult, transactions: enriched }))
        : rawResult;

    // Seed Storage for future requests (tip only)
    if (isTip) {
        const redis = getRedis();
        if (redis && result.transactions && result.transactions.length > 0) {
            const backupKey = `radix_txs_${network}_tip_${limit}_backup`;
            redis.set(backupKey, result).catch((e) =>
                logger.error({ err: e, network }, '[TransactionsService] Failed to seed Redis on cache miss'),
            );

        }
    }

    return result;
}

/**
 * Cached version of fetchRecentTransactions (Data Cache).
 *
 * SWR (Stale-While-Revalidate) pattern for the initial tip load:
 *   1. Upstash Redis (Storage) — fast return of stale data, then
 *      background API refresh via after() outside the cache boundary.
 *   2. Vercel Data Cache ("use cache") — instant if warm.
 *   3. Radix Gateway API (blocking cold-start) — first ever load.
 *   4. Absolute Fallback — returns empty state to prevent UI crash.
 */
export async function getRecentTransactionsCached(
    cursor?: string,
    limit = 15,
    network: Network = 'mainnet'
) {
    const isTip = !cursor;
    // Fix: Unify tip limit to 100 to prevent smaller queries from shrinking the cache
    const actualLimit = isTip ? 100 : limit;
    const redis = isTip ? getRedis() : null;
    const backupKey = `radix_txs_${network}_tip_${actualLimit}_backup`;

    // ── Step 1: Try Storage for instant SWR return (tip only) ──────────────
    if (redis && isTip) {
        try {
            const staleData = await redis.get<{
                transactions: TransactionInfo[];
                nextCursor: string | undefined;
                updatedAt?: number;
            }>(backupKey);

            if (staleData?.transactions && staleData.transactions.length > 0) {
                logger.info(
                    { network, count: staleData.transactions.length },
                    '[TransactionsService] Serving stale transactions tip from Redis for rapid response',
                );

                const now = Date.now();
                const isStale = !staleData.updatedAt || (now - staleData.updatedAt > REVALIDATION_THRESHOLD);

                if (isStale) {
                    // ── Step 2: Background revalidation ────────────────────────
                    // This call is OUTSIDE the "use cache" directive, so it can safely call revalidateTag.
                    after(async () => {
                        try {
                            logger.info({ network }, '[TransactionsService] Background revalidation started for transactions tip');
                            const rawResult = await fetchRecentTransactions(cursor, actualLimit, network);
                            const freshResult = await enrichTransactionsMetadata(rawResult.transactions, network)
                                .then(enriched => enrichTransactionsProposerInfo(enriched, network))
                                .then(enriched => ({ ...rawResult, transactions: enriched }));

                            if (freshResult.transactions && freshResult.transactions.length > 0) {
                                // Update Redis with timestamp + Invalidate Data Cache
                                await redis.set(backupKey, { ...freshResult, updatedAt: Date.now() });



                                // revalidateTag is safe here because we're in a standard server action/route/after context
                                revalidateTag(`transactions-${network}`, 'max');
                            }

                            logger.info({ network }, '[TransactionsService] Background revalidation complete');
                        } catch (bgError) {
                            logger.error({ err: bgError, network }, '[TransactionsService] Background revalidation failed');
                        }
                    });
                }

                return staleData;
            }
        } catch (redisReadError) {
            logger.error({ err: redisReadError, network }, '[TransactionsService] Redis read failed — falling through to Data Cache');
        }
    }

    // ── Step 3: Use Next.js Data Cache (with blocking fetch on miss) ───────
    try {
        return await getRecentTransactionsFromDataCache(cursor, actualLimit, network);
    } catch (error) {
        if (isTip) {
            logger.error(
                { network, error: String(error) },
                '[TransactionsService] All data sources exhausted for tip. Returning empty state.',
            );
            return { transactions: [] as TransactionInfo[], nextCursor: undefined };
        }
        // Paginated queries: propagate error so React Query can retry
        throw error;
    }
}


/**
 * Cached version of fetchRoundProposer (Data Cache).
 * A committed round's proposer is immutable — cache for 24 h.
 */
export async function getRoundProposerCached(
    epoch: number,
    round: number,
    stateVersion: number,
    network: Network = 'mainnet'
) {
    "use cache";
    cacheLife("days");
    cacheTag('round-proposer');

    const proposer = await fetchRoundProposer(epoch, round, stateVersion, network);
    if (!proposer) {
        throw new Error(`Round proposer not available for ${epoch}:${round} on ${network}`);
    }
    return proposer;
}
