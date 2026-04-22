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
import { unstable_cache, revalidateTag } from 'next/cache';
import type { TransactionInfo, StakeHistoryEntry, ValidatorOp } from '@/types/radix';
import { matchesTransactionTag } from '@/features/dashboard/explorador/utils/filterUtils';
import { after } from 'next/server';
import { Redis } from '@upstash/redis';


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
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });

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
// Extracts proposer validator index directly from the gateway items
// when receipt_state_changes and receipt_fee_destination are opted in.
// ─────────────────────────────────────────────────────────────────────────────
function resolveProposerInfoFromGatewayItem(item: GatewayItem): { validatorIndex: number; rank: number; rewardAmount: string } | undefined {
    if (!item.receipt?.fee_destination) return undefined;

    const fd = item.receipt.fee_destination;
    const toProposerRaw = fd.to_proposer;
    // to_proposer can be a simple string depending on Gateway version
    const toProposerAmtStr = typeof toProposerRaw === 'string'
        ? toProposerRaw
        : (toProposerRaw as { xrd_amount?: string } | undefined)?.xrd_amount;

    if (!toProposerAmtStr || toProposerAmtStr === '0') return undefined;
    const targetDelta = parseFloat(toProposerAmtStr);

    const substates = item.receipt.state_updates?.updated_substates as Array<{
        new_value?: { substate_data?: { value?: { proposer_rewards?: Array<{ xrd_amount: string; validator_index: { index: number } }> } } };
        previous_value?: { substate_data?: { value?: { proposer_rewards?: Array<{ xrd_amount: string; validator_index: { index: number } }> } } };
    }> | undefined;

    if (!substates) return undefined;

    let newRewards: Array<{ xrd_amount: string; validator_index: { index: number } }> = [];
    let previousRewards: Array<{ xrd_amount: string; validator_index: { index: number } }> = [];

    for (const entry of substates) {
        const nr = entry?.new_value?.substate_data?.value?.proposer_rewards;
        if (Array.isArray(nr) && nr.length > 0) {
            newRewards = nr;
            previousRewards = entry?.previous_value?.substate_data?.value?.proposer_rewards ?? [];
            break;
        }
    }

    if (newRewards.length === 0) return undefined;

    for (let i = 0; i < newRewards.length; i++) {
        const nr = newRewards[i];
        const pr = previousRewards[i];
        const newAmt = parseFloat(nr.xrd_amount);
        const prevAmt = pr ? parseFloat(pr.xrd_amount) : 0;
        const delta = newAmt - prevAmt;

        if (Math.abs(delta - targetDelta) < 0.000000000001) {
            const validatorIndex = nr.validator_index.index;
            return {
                validatorIndex,
                rank: validatorIndex + 1,
                rewardAmount: toProposerAmtStr,
            };
        }
    }

    return undefined;
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

// ─────────────────────────────────────────────────────────────────────────────
// fetchTransactionDetails
//
// Fetches the full committed transaction details for a given intent hash.
// Returns the raw Gateway item used by both /api/transactions/[hash] and
// the txid_ fast-path in searchTransactionsByAddress.
// ─────────────────────────────────────────────────────────────────────────────
const getCachedTransactionDetails = unstable_cache(
    async (hash: string, network: Network): Promise<unknown | null> => {
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
    },
    ['tx-details-base'],
    { revalidate: 3600, tags: ['transactions', 'tx-details'] }
);

export async function fetchTransactionDetails(
    hash: string,
    network: Network = 'mainnet',
): Promise<unknown | null> {
    return getCachedTransactionDetails(hash, network);
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
    dateRange?: { start?: string | null; end?: string | null; timezone?: string },
): Promise<{ transactions: TransactionInfo[]; nextCursor: string | undefined }> {
    // Fast path: a txid_ is a direct detail lookup, not a stream query
    if (address.startsWith('txid_')) {
        const item = await fetchTransactionDetails(address, network);
        if (!item) return { transactions: [], nextCursor: undefined };
        return {
            transactions: [parseTransactionItem(item as unknown as GatewayItem, undefined, network)],
            nextCursor: undefined,
        };
    }

    const gateway = getGateway(network);
    const isValidator = address.startsWith('validator_');
    const dateParams = buildLedgerDateParams(dateRange?.start, dateRange?.end, dateRange?.timezone);

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

        logger.info({
            network,
            address: address.slice(0, 16) + '...',
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
        throw new Error(`Failed to fetch transactions for address ${address}: ${message}`);
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
    address: string | undefined;
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
const getFilteredTransactionsFromDataCache = (
    options: {
        tag: string;
        start: string | null;
        end: string | null;
        cursor: string | undefined;
        limit: number;
        address: string | undefined;
        network: Network;
        timezone: string;
    },
    backupKey: string
) =>
    unstable_cache(
        async () => {
            logger.info({ tag: options.tag, address: options.address }, '[TransactionsService] Data Cache miss - fetching from API');
            const result = await fetchFilteredTransactionsRaw(options);

            // Seed Redis for SWR
            const redis = getRedisClient();
            if (backupKey && redis && result.transactions && result.transactions.length > 0) {
                redis.set(backupKey, result).catch(e =>
                    logger.error({ err: e }, '[TransactionsService] Failed to seed Redis for filtered query'),
                );
            }

            return result;
        },
        [`filtered-txs-${options.network}-${options.tag.replace(/\s+/g, '_').toLowerCase()}-${options.address || 'global'}-${options.start || 'all'}-${options.end || 'all'}-${options.timezone.replace(/\//g, '_')}-${options.cursor || 'tip'}-${options.limit}`],
        { revalidate: 30, tags: ['transactions', `transactions-${options.network}`] }
    )();

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
    address?: string;
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

    const redis = getRedisClient();

    // ── Step 1: Redis Fast Hit ───────────────────────────────────────────────
    if (redis) {
        try {
            const stale = await redis.get<{ transactions: TransactionInfo[]; nextCursor: string }>(backupKey);
            if (stale?.transactions && stale.transactions.length > 0) {
                logger.info({ tag, address, count: stale.transactions.length }, '[TransactionsService] Serving filtered transactions from Redis');

                // ── Step 2: Background Revalidation ──────────────────────────
                after(async () => {
                    try {
                        const fresh = await fetchFilteredTransactionsRaw(opParams);
                        if (fresh.transactions && fresh.transactions.length > 0) {
                            await redis.set(backupKey, fresh);
                            revalidateTag(`transactions-${network}`, 'max');
                            logger.info({ tag, network }, '[TransactionsService] Background filter revalidation complete');
                        }
                    } catch (bgErr) {
                        logger.error({ err: bgErr, tag }, '[TransactionsService] Background filter revalidation failed');
                    }
                });

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
            const day = dailyMap.get(dateStr);
            if (!day) continue;

            if (tx.stakeXrd) day.stake += tx.stakeXrd;
            if (tx.unstakeXrd) day.unstake += tx.unstakeXrd;
            if (tx.claimXrd) day.claim += tx.claimXrd;
        }

        if (!page.nextCursor) done = true;
        else cursor = page.nextCursor;
    }

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
// fetchStakeHistoryCached
//
// Reads the 90-day stake history directly from Upstash Redis, yielding an
// instant sub-20ms response time. Used by the Frontend UI.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchStakeHistoryCached(
    validatorAddress: string,
    network: Network = 'mainnet',
): Promise<StakeHistoryEntry[]> {
    try {
        const redis = getRedisClient();
        if (redis) {
            const cachedStr = await redis.hget<string>('stake_history_map', validatorAddress);
            if (cachedStr) {
                return typeof cachedStr === 'string' ? JSON.parse(cachedStr) : cachedStr;
            }
        }
    } catch (e) {
        logger.error({ err: e, validatorAddress }, '[TransactionsService] Failed to read stake history from Redis');
    }

    // Fallback: Calculate synchronously if missing from Redis
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

// ── Centralized Cache Wrappers ──────────────────────────────────────────────

const getRedisClient = () => {
    try {
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            const client = new Redis({
                url: process.env.KV_REST_API_URL,
                token: process.env.KV_REST_API_TOKEN,
            });
            logger.info('[TransactionsService] Upstash Redis client initialized successfully');
            return client;
        } else {
            logger.warn('[TransactionsService] Upstash Redis environment variables are missing (KV_REST_API_URL / KV_REST_API_TOKEN)');
        }
    } catch (e) {
        logger.error({ err: e }, '[TransactionsService] Failed to initialize Upstash Redis');
    }
    return null;
};

/**
 * Cached version of fetchRecentTransactions (Data Cache).
 *
 * SWR (Stale-While-Revalidate) pattern for the initial tip load:
 *   1. Vercel Data Cache (unstable_cache) — instant if warm.
 *   2. Upstash Redis (Storage) — fast return of stale data, then
 *      background API refresh via after().
 *   3. Radix Gateway API (blocking cold-start) — first ever load.
 *   4. Absolute Fallback — returns empty state to prevent UI crash.
 *
 * Paginated queries (cursor != null) always go to the API directly
 * since they cannot be meaningfully cached in Storage.
 */
const getRecentTransactionsFromDataCache = (
    cursor: string | undefined,
    limit: number,
    network: Network
) =>
    unstable_cache(
        async () => {
            const isTip = !cursor;
            const result = await fetchRecentTransactions(cursor, limit, network);

            // Seed Storage for future requests (tip only)
            if (isTip) {
                const redis = getRedisClient();
                if (redis && result.transactions && result.transactions.length > 0) {
                    const backupKey = `radix_txs_${network}_tip_${limit}_backup`;
                    redis.set(backupKey, result).catch((e) =>
                        logger.error({ err: e, network }, '[TransactionsService] Failed to seed Redis on cache miss'),
                    );

                    // Pre-warm the filtered views to keep them mathematically in sync
                    const prefetchTags = ['Success', 'Failed', 'With Message', 'With NFTs'];
                    Promise.allSettled(
                        prefetchTags.map(async (t) => {
                            const opParams = { tag: t, start: null, end: null, cursor: undefined, limit, address: undefined, network, timezone: 'UTC' };
                            const tagRes = await fetchFilteredTransactionsRaw(opParams);
                            if (tagRes.transactions && tagRes.transactions.length > 0) {
                                const tagSlug = t.replace(/\s+/g, '_').toLowerCase();
                                await redis.set(`radix_txs_filtered_${network}_${tagSlug}`, tagRes);
                            }
                        })
                    ).catch(() => { });
                }
            }

            return result;
        },
        [`recent-transactions-${network}-${cursor || 'tip'}-${limit}`],
        { revalidate: 10, tags: ['transactions', `transactions-${network}`] },
    )();

/**
 * Cached version of fetchRecentTransactions (Data Cache).
 *
 * SWR (Stale-While-Revalidate) pattern for the initial tip load:
 *   1. Upstash Redis (Storage) — fast return of stale data, then
 *      background API refresh via after() outside the cache boundary.
 *   2. Vercel Data Cache (unstable_cache) — instant if warm.
 *   3. Radix Gateway API (blocking cold-start) — first ever load.
 *   4. Absolute Fallback — returns empty state to prevent UI crash.
 */
export async function getRecentTransactionsCached(
    cursor?: string,
    limit = 15,
    network: Network = 'mainnet'
) {
    const isTip = !cursor;
    const redis = isTip ? getRedisClient() : null;
    const backupKey = `radix_txs_${network}_tip_${limit}_backup`;

    // ── Step 1: Try Storage for instant SWR return (tip only) ──────────────
    if (redis && isTip) {
        try {
            const staleData = await redis.get<{
                transactions: TransactionInfo[];
                nextCursor: string | undefined;
            }>(backupKey);

            if (staleData?.transactions && staleData.transactions.length > 0) {
                logger.info(
                    { network, count: staleData.transactions.length },
                    '[TransactionsService] Serving stale transactions tip from Redis for rapid response',
                );

                // ── Step 2: Background revalidation ────────────────────────
                // This call is OUTSIDE unstable_cache, so it can safely call revalidateTag.
                after(async () => {
                    try {
                        logger.info({ network }, '[TransactionsService] Background revalidation started for transactions tip');
                        const freshResult = await fetchRecentTransactions(cursor, limit, network);

                        if (freshResult.transactions && freshResult.transactions.length > 0) {
                            // Update Redis + Invalidate Data Cache
                            await redis.set(backupKey, freshResult);

                            // Pre-warm the filtered views to keep them mathematically in sync
                            const prefetchTags = ['Success', 'Failed', 'With Message', 'With NFTs'];
                            await Promise.allSettled(
                                prefetchTags.map(async (t) => {
                                    const opParams = { tag: t, start: null, end: null, cursor: undefined, limit, address: undefined, network, timezone: 'UTC' };
                                    const tagRes = await fetchFilteredTransactionsRaw(opParams);
                                    if (tagRes.transactions && tagRes.transactions.length > 0) {
                                        const tagSlug = t.replace(/\s+/g, '_').toLowerCase();
                                        await redis.set(`radix_txs_v2_filtered_${network}_${tagSlug}`, tagRes);
                                    }
                                })
                            );

                            // revalidateTag is safe here because we're in a standard server action/route/after context
                            revalidateTag(`transactions-${network}`, 'max');
                        }

                        logger.info({ network }, '[TransactionsService] Background revalidation complete with pre-warmed tags');
                    } catch (bgError) {
                        logger.error({ err: bgError, network }, '[TransactionsService] Background revalidation failed');
                    }
                });

                return staleData;
            }
        } catch (redisReadError) {
            logger.error({ err: redisReadError, network }, '[TransactionsService] Redis read failed — falling through to Data Cache');
        }
    }

    // ── Step 3: Use Next.js Data Cache (with blocking fetch on miss) ───────
    try {
        return await getRecentTransactionsFromDataCache(cursor, limit, network);
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
export const getRoundProposerCached = (
    epoch: number,
    round: number,
    stateVersion: number,
    network: Network = 'mainnet'
) =>
    unstable_cache(
        async () => {
            const proposer = await fetchRoundProposer(epoch, round, stateVersion, network);
            if (!proposer) {
                throw new Error(`Round proposer not available for ${epoch}:${round} on ${network}`);
            }
            return proposer;
        },
        [`round-proposer-${network}-${epoch}-${round}-${stateVersion}`],
        { revalidate: 86400, tags: ['round-proposer'] },
    )();
