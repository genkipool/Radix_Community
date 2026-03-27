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
import type { TransactionInfo, StakeHistoryEntry, ValidatorOp } from '@/types/radix';
import { matchesTransactionTag } from '@/features/dashboard/explorador/utils/filterUtils';


// ── Opaque Gateway response types ────────────────────────────────────────────
type GatewayField   = { 
    value?: string; 
    name?: string; 
    kind?: string; 
    field_name?: string;
    fields?: Array<{ kind: string; value: string; field_name: string }>;
};
type GatewayEvent   = {
    name?: string;
    emitter?: { entity?: { entity_address?: string } };
    emitter_address?: string;
    data?: { 
        fields?: GatewayField[];
        programmatic_json?: { fields: GatewayField[] };
    };
};
type GatewayItem    = {
    fee_paid?: string;
    affected_global_entities?: string[];
    receipt?: { status?: string; events?: GatewayEvent[]; state_updates?: { updated_substates?: unknown[] } };
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
type BalanceChange  = { resource_address: string; entity_address: string; balance_change: string };

// ── Server-side stake-history cache ──────────────────────────────────────────
// Key: "network:address"
const stakeHistoryCache = new Map<string, { data: StakeHistoryEntry[]; expiry: number }>();
const STAKE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Shared opt-ins used by all streamTransactions calls
// ─────────────────────────────────────────────────────────────────────────────
const STREAM_OPT_INS = {
    affected_global_entities: true,
    balance_changes: true,
    receipt_events: true,
    confirmed_at: true,
} as const;


// ─────────────────────────────────────────────────────────────────────────────
// buildLedgerDateParams
//
// Translates YYYY-MM-DD strings into the Gateway's ledger state selectors,
// accounting for the caller's UTC offset so that "April 6" always means
// midnight-to-midnight in the user's local timezone.
//
// tzOffsetMinutes: value of `new Date().getTimezoneOffset()` on the client
//   (negative for UTC+, positive for UTC-). 0 means UTC.
//
// - `from_ledger_state.timestamp` = start of the start day in local time → UTC
// - `at_ledger_state.timestamp`   = end of the end day in local time → UTC
// ─────────────────────────────────────────────────────────────────────────────
function buildLedgerDateParams(
    start?: string | null,
    end?: string | null,
    tzOffsetMinutes = 0,
): {
    from_ledger_state?: { timestamp: Date };
    at_ledger_state?: { timestamp: Date };
} {
    const params: {
        from_ledger_state?: { timestamp: Date };
        at_ledger_state?: { timestamp: Date };
    } = {};

    if (start) {
        // "start of day" in local time = 00:00:00 local = 00:00 + tzOffset in UTC
        const fromLocal = new Date(`${start}T00:00:00.000Z`);
        fromLocal.setUTCMinutes(fromLocal.getUTCMinutes() + tzOffsetMinutes);
        params.from_ledger_state = { timestamp: fromLocal };
    }

    if (end) {
        // "end of day" in local time = 23:59:59.999 local = 23:59:59.999 + tzOffset in UTC
        const atLocal = new Date(`${end}T23:59:59.999Z`);
        atLocal.setUTCMinutes(atLocal.getUTCMinutes() + tzOffsetMinutes);
        params.at_ledger_state = { timestamp: atLocal };
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
    const f =
        fields.find((x) => names.includes(x.field_name as string)) ||
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
            const fwd  = Array.from({ length: 10 }, (_, k) => ei + k + 1).filter(
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
            stakeXrd   = stakeFromEvents   || undefined;
            unstakeXrd = unstakeFromEvents || undefined;
            claimXrd   = claimFromEvents   || undefined;
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
                    if (delta > 0) stakeBC   += delta;
                    else           outflowBC += Math.abs(delta);
                }
            }
            if (stakeBC > 0)   stakeXrd = stakeBC;
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

    return {
        intentHash:
            item.intent_hash ||
            item.transaction_hash ||
            item.state_version?.toString() ||
            '',
        status:      item.receipt?.status || 'Committed',
        feePaid:     Number(feeString),
        confirmedAt:
            item.confirmed_at || item.round_timestamp
                ? new Date((item.confirmed_at || item.round_timestamp) as string)
                : new Date(),
        message:          item.message?.content?.value || undefined,
        epoch:            item.epoch  || 0,
        round:            item.round  || 0,
        accountsCount:    entities.filter((e: string) => e.startsWith('account_')).length,
        componentsCount:  entities.filter((e: string) => e.startsWith('component_')).length,
        hasNfts:
            (item.balance_changes?.non_fungible_balance_changes?.length ?? 0) > 0 ||
            entities.some((e: string) => e.startsWith('resource_') && e.includes(':')),
        manifestClasses,
        validatorAddress:
            entities.find((e: string) => typeof e === 'string' && e.startsWith('validator_')) ??
            undefined,
        validatorOps,
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
    dateRange?: { start?: string | null; end?: string | null; tzOffsetMinutes?: number },
): Promise<{ transactions: TransactionInfo[]; nextCursor: string | undefined }> {
    const gateway    = getGateway(network);
    const dateParams = buildLedgerDateParams(dateRange?.start, dateRange?.end, dateRange?.tzOffsetMinutes);

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

        return {
        transactions: (res.items || []).map(item => parseTransactionItem(item as unknown as GatewayItem, undefined, network)),
        nextCursor:   res.next_cursor || undefined,
    };
    } catch (error) {
        logger.error(
            { err: error },
            'Error fetching recent txs: %s',
            error instanceof Error ? error.message : String(error),
        );
        return { transactions: [], nextCursor: undefined };
    }
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
    const restBase =
        network === 'stokenet'
            ? 'https://stokenet.radixdlt.com'
            : 'https://mainnet.radixdlt.com';
    try {
        const res = await withRetry(async () => {
            const r = await fetch(`${restBase}/transaction/committed-details`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intent_hash: hash,
                    opt_ins: {
                        receipt_events:           true,
                        affected_global_entities: true,
                        balance_changes:          true,
                        receipt_fee_summary:      true,
                        receipt_fee_destination:  true,
                        manifest_instructions:    true,
                        confirmed_at:             true,
                    },
                }),
            });
            if (!r.ok)
                throw Object.assign(new Error(`Gateway ${r.status}`), { status: r.status });
            return r.json();
        });
        return res?.transaction ?? null;
    } catch (error) {
        logger.error(
            { err: error },
            'fetchTransactionDetails error: %s',
            error instanceof Error ? error.message : String(error),
        );
        return null;
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
    address: string,
    cursor?: string,
    limit = 15,
    network: Network = 'mainnet',
    dateRange?: { start?: string | null; end?: string | null; tzOffsetMinutes?: number },
): Promise<{ transactions: TransactionInfo[]; nextCursor: string | undefined }> {
    // Fast path: a txid_ is a direct detail lookup, not a stream query
    if (address.startsWith('txid_')) {
        const item = await fetchTransactionDetails(address, network);
        if (!item) return { transactions: [], nextCursor: undefined };
        return {
        transactions: [parseTransactionItem(item as unknown as GatewayItem, undefined, network)],
        nextCursor:   undefined,
    };
    }

    const gateway     = getGateway(network);
    const isValidator = address.startsWith('validator_');
    const dateParams  = buildLedgerDateParams(dateRange?.start, dateRange?.end, dateRange?.tzOffsetMinutes);

    try {
        const res = await withRetry(() =>
            gateway.stream.innerClient.streamTransactions({
                streamTransactionsRequest: {
                    limit_per_page: limit,
                    cursor,
                    affected_global_entities_filter: [address],
                    opt_ins: STREAM_OPT_INS as Parameters<typeof gateway.stream.innerClient.streamTransactions>[0]['streamTransactionsRequest']['opt_ins'],
                    ...dateParams,
                },
            }),
        );

        const transactions = (res.items || []).map((item) =>
            parseTransactionItem(item as unknown as GatewayItem, isValidator ? address : undefined, network),
        );
        return { transactions, nextCursor: res.next_cursor || undefined };
    } catch (error) {
        logger.error(
            { err: error },
            'Error fetching txs by address: %s',
            error instanceof Error ? error.message : String(error),
        );
        return { transactions: [], nextCursor: undefined };
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
export async function fetchFilteredTransactions(options: {
    tag?: string;
    start?: string | null;
    end?: string | null;
    cursor?: string;
    limit?: number;
    address?: string;
    network?: Network;
    tzOffsetMinutes?: number;
}): Promise<{ transactions: TransactionInfo[]; nextCursor: string | undefined }> {
    const {
        tag = 'All',
        start = null,
        end   = null,
        cursor: initialCursor,
        limit   = 15,
        address,
        network = 'mainnet',
        tzOffsetMinutes = 0,
    } = options;

    const dateRange = { start, end, tzOffsetMinutes };
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

    return {
        transactions: results.slice(0, limit),
        nextCursor:
            results.length >= limit
                ? currentCursor
                : pageCount < MAX_PAGES
                  ? currentCursor
                  : undefined,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchStakeHistoryCached
//
// Aggregates 90 days of stake/unstake/claim activity for a validator.
// Results are memory-cached for 5 minutes. Uses native date filtering so the
// Gateway only returns transactions from the last 90 days.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchStakeHistoryCached(
    validatorAddress: string,
    network: Network = 'mainnet',
): Promise<StakeHistoryEntry[]> {
    const cacheKey = `${network}:${validatorAddress}`;
    const cached   = stakeHistoryCache.get(cacheKey);
    const now      = Date.now();

    if (cached && cached.expiry > now) return cached.data;

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

    while (!done && pageCount < MAX_PAGES) {
        const page = await searchTransactionsByAddress(
            validatorAddress,
            cursor,
            100,
            network,
            { start: startDate },
        );
        pageCount++;

        for (const tx of page.transactions) {
            const confirmedAt =
                tx.confirmedAt instanceof Date ? tx.confirmedAt : new Date(tx.confirmedAt);
            if (confirmedAt < ninetyDaysAgo) { done = true; break; }

            const dateStr = confirmedAt.toISOString().split('T')[0];
            const day     = dailyMap.get(dateStr);
            if (!day) continue;

            if (tx.stakeXrd)   day.stake   += tx.stakeXrd;
            if (tx.unstakeXrd) day.unstake += tx.unstakeXrd;
            if (tx.claimXrd)   day.claim   += tx.claimXrd;
        }

        if (!page.nextCursor) done = true;
        else cursor = page.nextCursor;
    }

    const history = Array.from(dailyMap.entries())
        .map(([date, vals]) => ({ date, ...vals }))
        .sort((a, b) => a.date.localeCompare(b.date));

    stakeHistoryCache.set(cacheKey, { data: history, expiry: now + STAKE_CACHE_TTL });

    // Evict oldest entry when cache grows large
    if (stakeHistoryCache.size > 500) {
        const oldestKey = stakeHistoryCache.keys().next().value;
        if (oldestKey) stakeHistoryCache.delete(oldestKey);
    }

    return history;
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchRoundProposer
//
// Looks up the validator that proposed a specific epoch/round combination.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchRoundProposer(
    epoch:        number,
    round:        number,
    stateVersion: number,
    network:      Network = 'mainnet',
): Promise<string | null> {
    const gateway = getGateway(network);
    try {
        const res = await gateway.stream.innerClient.streamTransactions({
            streamTransactionsRequest: {
                at_ledger_state: { state_version: stateVersion },
                limit_per_page:  30,
                order:           'Desc',
                opt_ins:         { receipt_events: true } as Parameters<typeof gateway.stream.innerClient.streamTransactions>[0]['streamTransactionsRequest']['opt_ins'],
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
