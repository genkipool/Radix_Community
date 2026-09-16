/**
 * services/gateway/protocolVotes.ts
 *
 * Which protocol-update signal each validator has cast, read from the ledger.
 *
 * There is no field to read this from. `/state/validators/list` carries the
 * validator's whole substate (stake, fee, keys, registration) and nothing
 * about readiness, the consensus manager exposes no state at all through the
 * Gateway, and the stream's event filter only understands Deposit and
 * Withdrawal. The signal exists solely as a `ProtocolUpdateReadinessSignalEvent`
 * in the receipt of the transaction that cast it.
 *
 * Neither entity filter helps to gather them in bulk: both
 * `affected_global_entities_filter` and `event_global_emitters_filter` combine
 * their addresses with AND, so a list of validators matches only transactions
 * touching every one of them. Votes are therefore collected two ways, and the
 * split is what keeps this cheap:
 *
 *   History, per validator. Scanning one validator forwards from the epoch the
 *   update was announced finds its vote within a page or two. Used for the
 *   validators the connected wallet owns, whose badge is a button.
 *
 *   From now on, the whole network at once. Mainnet commits roughly 670 user
 *   transactions a day, so reading the global stream forward from a saved
 *   marker costs about seven pages a day and catches every vote, whoever cast
 *   it and from whatever tool. Reading that same stream backwards over the
 *   update's whole history would be millions of transactions, which is why the
 *   marker starts at the ledger tip and the past is left to the two seeds
 *   above.
 *
 * A vote is attributed by the event's own `emitter`, never by the
 * transaction's affected entities: a vote transaction can list no validator
 * there at all, while an epoch change lists every one of them.
 */

import { getGateway, withRetry, type Network } from './client';
import logger from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import snapshotRaw from '@/constants/protocol-votes.json';
import {
    protocolSignal,
    protocolTargetEnabled,
} from '@/features/dashboard/staking/constants/protocolUpdate';

/**
 * The hand-generated snapshot, kept as the seed for mainnet's history. It is
 * no longer the source of truth: Redis is, and this only fills it the first
 * time. It never held a Stokenet address.
 */
const SNAPSHOT = snapshotRaw as Record<string, string>;

/** validator address → the version name it signalled. */
const votesKey = (network: Network) => `protocol_votes_${network}`;
/** The ledger position the global stream has been read up to. */
const markerKey = (network: Network) => `protocol_votes_${network}_marker`;
/** Per-validator answers from the historical scan. */
const scanKey = (network: Network, address: string) => `protocol_vote_${network}_${address}`;

/**
 * Where the per-validator scan starts. Mainnet begins at the epoch Cuttlefish
 * signalling opened, which is what makes a page or two enough; Stokenet is
 * young enough that its whole history is cheap.
 */
const START_EPOCH: Record<Network, number> = {
    mainnet: 150_000,
    stokenet: 1,
};

/** Pages read per validator by the historical scan before giving up. */
const MAX_PAGES = 5;
/**
 * Pages read per run by the global tail. Bounded so a site that went quiet for
 * weeks catches up across several visits instead of trying it all at once, and
 * stays well inside the 55s the cron routes allow themselves.
 */
const TAIL_MAX_PAGES = 10;
const PAGE_SIZE = 100;

/** A cast vote never changes, so it is held far longer than a missing one. */
const TTL_VOTED_S = 24 * 60 * 60;
const TTL_NOT_VOTED_S = 2 * 60;

type StreamEvent = {
    name?: string;
    emitter?: { entity?: { entity_address?: string; entity_type?: string } };
    data?: { fields?: Array<{ field_name?: string; value?: string }> };
};
type StreamItem = {
    receipt?: { events?: StreamEvent[]; status?: string };
    transaction_status?: string;
    state_version?: number;
};

/** The version name carried by a readiness event, if that is what this is. */
function readSignal(event: StreamEvent): string {
    if (!event?.name?.includes('ProtocolUpdateReadinessSignal')) return '';
    const field = event.data?.fields?.find((f) => f.field_name === 'protocol_version_name');
    return (field?.value ?? '').trim();
}

/** The validator that emitted the event, which is the one that voted. */
function readEmitter(event: StreamEvent): string {
    const address = event.emitter?.entity?.entity_address ?? '';
    return address.startsWith('validator_') ? address : '';
}

/** Whether the transaction committed. A failed one emits no events anyway. */
function committed(item: StreamItem): boolean {
    const status = item.transaction_status ?? item.receipt?.status;
    return !status || status.toLowerCase().includes('success');
}

/**
 * Every vote known for this network: what the ledger has told us so far, over
 * the snapshot that seeds mainnet's history. Falls back to the snapshot alone
 * when Redis is not configured, so a deployment without it is no worse off
 * than before.
 */
export async function getVotesMap(network: Network = 'mainnet'): Promise<Record<string, string>> {
    const seed = network === 'mainnet' ? SNAPSHOT : {};
    const redis = getRedis();
    if (!redis) return seed;

    try {
        const stored = await redis.hgetall<Record<string, string>>(votesKey(network));
        if (stored && Object.keys(stored).length > 0) return { ...seed, ...stored };

        // First run: plant the seed so the store grows from it instead of
        // depending on a file that has to be regenerated by hand.
        if (Object.keys(seed).length > 0) {
            await redis.hset(votesKey(network), seed);
        }
        return seed;
    } catch (err) {
        logger.error({ err, network }, '[ProtocolVotes] Votes map read failed');
        return seed;
    }
}

/** Records one validator's signal. */
async function recordVote(network: Network, address: string, signal: string): Promise<void> {
    const redis = getRedis();
    if (!redis || !address || !signal) return;
    try {
        await redis.hset(votesKey(network), { [address]: signal });
    } catch (err) {
        logger.error({ err, network, address }, '[ProtocolVotes] Vote write failed');
    }
}

/**
 * Reads the global stream forward from the saved marker and records every vote
 * it finds, whoever cast it. Returns null when there is nothing to do: no
 * update is open, or Redis is not configured.
 *
 * With no marker yet it saves the current ledger position and reads nothing:
 * walking mainnet's history this way would be millions of transactions, and
 * the past is already covered by the snapshot and the per-validator scan.
 */
export async function advanceVoteTail(
    network: Network = 'mainnet',
): Promise<{ scanned: number; found: number; marker: number } | null> {
    if (!protocolTargetEnabled(network)) return null;
    const redis = getRedis();
    if (!redis) return null;

    const gateway = getGateway(network);

    try {
        const marker = await redis.get<number>(markerKey(network));
        const status = await withRetry(() => gateway.status.getCurrent());
        const tip = status.ledger_state.state_version;

        if (!marker) {
            await redis.set(markerKey(network), tip);
            logger.info({ network, tip }, '[ProtocolVotes] Tail marker started at the ledger tip');
            return { scanned: 0, found: 0, marker: tip };
        }

        /*
         * Nothing has committed since the last run. Asking anyway would be a
         * request for a position the ledger has not reached, which the Gateway
         * rejects outright ("State version is beyond the end of the known
         * ledger") rather than answering with an empty page.
         */
        if (marker >= tip) return { scanned: 0, found: 0, marker };

        let cursor: string | undefined;
        let scanned = 0;
        let found = 0;
        let position = marker;
        const discovered: Record<string, string> = {};

        for (let page = 0; page < TAIL_MAX_PAGES; page++) {
            const res = await withRetry(() =>
                gateway.stream.innerClient.streamTransactions({
                    streamTransactionsRequest: {
                        from_ledger_state: { state_version: position + 1 },
                        order: 'Asc',
                        limit_per_page: PAGE_SIZE,
                        ...(cursor ? { cursor } : {}),
                        opt_ins: { receipt_events: true } as Parameters<
                            typeof gateway.stream.innerClient.streamTransactions
                        >[0]['streamTransactionsRequest']['opt_ins'],
                    },
                }),
            );

            const items = (res.items ?? []) as StreamItem[];
            scanned += items.length;

            for (const item of items) {
                if (typeof item.state_version === 'number' && item.state_version > position) {
                    position = item.state_version;
                }
                if (!committed(item)) continue;
                for (const event of item.receipt?.events ?? []) {
                    const signal = readSignal(event);
                    const address = readEmitter(event);
                    if (!signal || !address) continue;
                    discovered[address] = signal;
                    found++;
                }
            }

            cursor = res.next_cursor ?? undefined;
            if (!cursor) {
                /*
                 * The range is exhausted, so everything up to the position read
                 * before the scan has been seen, transactions included that the
                 * stream does not return. Parking the marker on the last item
                 * instead would re-read the same empty stretch on every run.
                 * Anything committed during the scan sits beyond that position
                 * and is picked up next time.
                 */
                position = Math.max(position, tip);
                break;
            }
        }

        if (Object.keys(discovered).length > 0) {
            await redis.hset(votesKey(network), discovered);
            logger.info({ network, votes: Object.keys(discovered).length }, '[ProtocolVotes] Votes picked up from the stream');
        }
        await redis.set(markerKey(network), position);

        return { scanned, found, marker: position };
    } catch (err) {
        // The marker is only saved on a clean run, so a failure here simply
        // means the same stretch is read again next time.
        logger.error({ err, network }, '[ProtocolVotes] Tail advance failed');
        return null;
    }
}

/**
 * The validator's most recent signal, scanned from the epoch the update was
 * announced. Stops early once the configured target is found: that is the
 * answer the badge is asking about, and nothing later can override it.
 */
async function scanForSignal(validatorAddress: string, network: Network): Promise<string> {
    const gateway = getGateway(network);
    const target = protocolSignal(network);
    let cursor: string | undefined;
    let latest = '';

    for (let page = 0; page < MAX_PAGES; page++) {
        const res = await withRetry(() =>
            gateway.stream.innerClient.streamTransactions({
                streamTransactionsRequest: {
                    affected_global_entities_filter: [validatorAddress],
                    from_ledger_state: { epoch: START_EPOCH[network] },
                    order: 'Asc',
                    limit_per_page: PAGE_SIZE,
                    ...(cursor ? { cursor } : {}),
                    opt_ins: { receipt_events: true } as Parameters<
                        typeof gateway.stream.innerClient.streamTransactions
                    >[0]['streamTransactionsRequest']['opt_ins'],
                },
            }),
        );

        for (const item of (res.items ?? []) as StreamItem[]) {
            for (const event of item.receipt?.events ?? []) {
                const signal = readSignal(event);
                if (!signal) continue;
                if (signal === target) return signal;
                latest = signal;
            }
        }

        cursor = res.next_cursor ?? undefined;
        if (!cursor) break;
    }

    return latest;
}

/**
 * The signal this validator has cast, from the shared store when it is already
 * known and from a scan of its own history otherwise. Returns '' when it has
 * not voted, and on failure, because "we could not read it" must not be shown
 * as a vote the validator never made.
 */
export async function fetchValidatorProtocolVote(
    validatorAddress: string,
    network: Network = 'mainnet',
): Promise<string> {
    const redis = getRedis();
    const key = scanKey(network, validatorAddress);

    if (redis) {
        try {
            const known = await redis.hget<string>(votesKey(network), validatorAddress);
            if (typeof known === 'string' && known) return known;

            const cached = await redis.get<string>(key);
            if (typeof cached === 'string') return cached;
        } catch (err) {
            logger.error({ err, network, validatorAddress }, '[ProtocolVotes] Cache read failed');
        }
    }

    try {
        const signal = await scanForSignal(validatorAddress, network);
        if (redis) {
            redis
                .set(key, signal, { ex: signal ? TTL_VOTED_S : TTL_NOT_VOTED_S })
                .catch((err) => logger.error({ err, network }, '[ProtocolVotes] Cache write failed'));
        }
        if (signal) await recordVote(network, validatorAddress, signal);
        return signal;
    } catch (err) {
        logger.error({ err, network, validatorAddress }, '[ProtocolVotes] Scan failed');
        return '';
    }
}

/** The same read for a small set of validators, one entry per address. */
export async function fetchProtocolVotes(
    validatorAddresses: string[],
    network: Network = 'mainnet',
): Promise<Record<string, string>> {
    const unique = Array.from(new Set(validatorAddresses)).filter(Boolean);
    const signals = await Promise.all(
        unique.map((address) => fetchValidatorProtocolVote(address, network)),
    );
    return Object.fromEntries(unique.map((address, i) => [address, signals[i]]));
}

/**
 * Drops the scanned answer for a validator, so the badge can be re-read from
 * the ledger as soon as a vote has been signed rather than after the TTL.
 */
export async function forgetProtocolVote(
    validatorAddress: string,
    network: Network = 'mainnet',
): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
        await redis.del(scanKey(network, validatorAddress));
    } catch (err) {
        logger.error({ err, network, validatorAddress }, '[ProtocolVotes] Cache drop failed');
    }
}
