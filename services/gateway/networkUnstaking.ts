import logger from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { readBlob, writeBlob } from '@/lib/redisBlob';
import { gatewayPost } from './bases';
import { getValidatorsCached } from './validators';
import type { Network } from './client';

/*
 * How much XRD the network has waiting to be withdrawn from staking, and when
 * it unlocks.
 *
 * Every validator keeps the XRD of unstakes in a vault of its own
 * (`pending_xrd_withdraw_vault`): what is still in the unlocking period plus
 * what has unlocked and not been claimed yet. Adding those vaults up is exact,
 * but on mainnet most of it unlocked long ago and was never claimed, so it is NOT
 * the coming wave.
 *
 * What is still locked is exactly what was unstaked in the last 7 days (every
 * unstake waits the same 2,016 epochs). Those are few — ~190 transactions a
 * week on mainnet — so they are read straight from the ledger: each unstake
 * moves its XRD from the validator's stake vault into its pending vault, and
 * that deposit event is the exact amount. Kept with their time, they give the
 * locked total now, the same total 24 h and 7 days ago, and the day each part
 * unlocks (its time + 7 days).
 *
 * Gateway cost, all behind a lock and at most every 15 minutes, by whoever asks
 * first: ~15 requests of 20 addresses for the vaults (their addresses never
 * change, so they are found once), and a page of 25 unstake transactions to catch
 * up on the new ones. The first run also reads the last two weeks, a few pages.
 * Readers only ever get what Redis holds.
 */

const BATCH = 20;
/** Pause between requests; the Gateway allows ~160 a minute and the whole site shares it. */
const REQUEST_GAP_MS = 500;
const REFRESH_AFTER_MS = 15 * 60 * 1000;
const LOCK_SECONDS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The unlock delay is 2,016 epochs of ~5 minutes: exactly 7 days. */
export const UNLOCK_DAYS = 7;
/** Unstakes are kept for 14 days + a day: enough to say what the locked total was 7 days ago. */
const KEEP_MS = (2 * UNLOCK_DAYS + 1) * DAY_MS;
/** Unstake transactions per request, and how many requests one refresh may spend catching up or backfilling. */
const PAGE = 25;
const BACKFILL_PAGE = 100;
const MAX_PAGES_PER_REFRESH = 5;
/** Days of schedule shown: today, and the seven after it. */
const SCHEDULE_DAYS = UNLOCK_DAYS + 1;

/** One validator's part of an unstake transaction. */
interface Unstake {
    /** State version of the transaction; one transaction can hold several unstakes. */
    sv: number;
    /** When it was made, in ms. */
    time: number;
    /** XRD it moved into the validator's pending vault. */
    xrd: number;
    validator: string;
    /** The account whose LSUs were burned; null when the events do not say. */
    account: string | null;
}

interface UnstakingState {
    /** Validator address → address of its pending-withdraw vault. Never changes. */
    vaults: Record<string, string>;
    /** XRD in the vaults of every validator that could be read. */
    pending: number;
    validators: number;
    updatedAt?: number;
    /** Unstakes of the last 15 days, newest first. */
    unstakes: Unstake[];
    /** The newest state version read; the next catch-up stops there. */
    lastSeen?: number;
    /** Older unstakes still to read (the first run is interrupted by the page budget): where to resume. */
    backfill?: { cursor: string };
    /** Time of the oldest unstake transaction read, or the horizon once the ledger was read that far. */
    coveredFrom?: number;
}

export interface UnlockDay {
    /** UTC date, YYYY-MM-DD. */
    date: string;
    xrd: number;
}

/** What one account has unlocking: the part of the wave that is theirs. */
export interface AccountUnlock {
    address: string;
    /** XRD of theirs still locked. */
    xrd: number;
    /** Unstake transactions behind it. */
    unstakes: number;
    /** Validators they unstaked from, the biggest first. */
    validators: string[];
    /** When their first part unlocks, and when they last unstaked, in ms. */
    nextUnlock: number;
    lastUnstake: number;
}

export interface NetworkUnstaking {
    /** XRD in the validators' pending-withdraw vaults: locked, plus unlocked and unclaimed. */
    pending: number;
    /** Of it, the part still locked (unstaked within 7 days); null until the ledger has been read that far. */
    unbonding: number | null;
    /** The same figure 24 h and 7 days ago; null until the ledger has been read that far back. */
    unbonding24hAgo: number | null;
    unbonding7dAgo: number | null;
    /** When the locked part unlocks, by UTC day, today first; empty when unknown. */
    schedule: UnlockDay[];
    /** Who has it unlocking, biggest first; empty when unknown. */
    accounts: AccountUnlock[];
    /** XRD of the locked part whose account the events did not name. */
    unattributedXrd: number;
    validators: number;
    updatedAt: number | null;
}

// v2: unstakes carry their account and validator.
const stateKey = (network: Network) => `network_unstaking_v2_${network}`;
const lockKey = (network: Network) => `network_unstaking_lock_${network}`;

const memory = new Map<string, UnstakingState>();
const memoryLocks = new Map<string, number>();

const emptyState = (): UnstakingState => ({ vaults: {}, pending: 0, validators: 0, unstakes: [] });

async function readState(network: Network): Promise<UnstakingState | null> {
    const redis = getRedis();
    if (!redis) return memory.get(stateKey(network)) ?? null;
    return readBlob<UnstakingState>(redis, stateKey(network));
}

async function writeState(network: Network, state: UnstakingState) {
    const redis = getRedis();
    if (!redis) {
        memory.set(stateKey(network), state);
        return;
    }
    await writeBlob(redis, stateKey(network), state);
}

async function takeLock(network: Network, seconds: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
        if ((memoryLocks.get(lockKey(network)) ?? 0) > Date.now()) return false;
        memoryLocks.set(lockKey(network), Date.now() + seconds * 1000);
        return true;
    }
    return (await redis.set(lockKey(network), '1', { nx: true, ex: seconds })) === 'OK';
}

async function extendLock(network: Network, seconds: number) {
    const redis = getRedis();
    if (!redis) {
        memoryLocks.set(lockKey(network), Date.now() + seconds * 1000);
        return;
    }
    await redis.set(lockKey(network), '1', { ex: seconds });
}

const isStale = (state: UnstakingState | null, now = Date.now()) =>
    !state?.updatedAt || !!state.backfill || now - state.updatedAt > REFRESH_AFTER_MS;

/* ── The figures, from the unstakes ── */

/** XRD unstaked within the 7 days up to `at`: all of it was still locked at `at`. */
function lockedAt(unstakes: Unstake[], at: number): number {
    const from = at - UNLOCK_DAYS * DAY_MS;
    return unstakes.reduce((sum, { time, xrd }) => (time > from && time <= at ? sum + xrd : sum), 0);
}

/** Each unstake unlocks 7 days after it was made; summed by the UTC day that falls on, from today on. */
function scheduleFrom(unstakes: Unstake[], at: number): UnlockDay[] {
    const today = Math.floor(at / DAY_MS) * DAY_MS;
    const days = Array.from({ length: SCHEDULE_DAYS }, (_, i) => ({ date: new Date(today + i * DAY_MS).toISOString().slice(0, 10), xrd: 0 }));
    for (const { time, xrd } of unstakes) {
        const unlocksAt = time + UNLOCK_DAYS * DAY_MS;
        if (unlocksAt <= at) continue;
        const day = days[Math.floor((unlocksAt - today) / DAY_MS)];
        if (day) day.xrd += xrd;
    }
    return days;
}

/** Most accounts listed: the biggest hold nearly all of the wave. */
const MAX_ACCOUNTS = 200;

/** The locked unstakes grouped by account, the biggest first. */
function accountsFrom(unstakes: Unstake[], at: number): { accounts: AccountUnlock[]; unattributedXrd: number } {
    const from = at - UNLOCK_DAYS * DAY_MS;
    const byAccount = new Map<string, { xrd: number; sv: Set<number>; byValidator: Map<string, number>; first: number; last: number }>();
    let unattributedXrd = 0;

    for (const u of unstakes) {
        if (u.time <= from || u.time > at) continue;
        if (!u.account) {
            unattributedXrd += u.xrd;
            continue;
        }
        const entry = byAccount.get(u.account) ?? { xrd: 0, sv: new Set<number>(), byValidator: new Map<string, number>(), first: Infinity, last: 0 };
        entry.xrd += u.xrd;
        entry.sv.add(u.sv);
        entry.byValidator.set(u.validator, (entry.byValidator.get(u.validator) ?? 0) + u.xrd);
        entry.first = Math.min(entry.first, u.time);
        entry.last = Math.max(entry.last, u.time);
        byAccount.set(u.account, entry);
    }

    const accounts = [...byAccount.entries()]
        .map(([address, e]) => ({
            address,
            xrd: e.xrd,
            unstakes: e.sv.size,
            validators: [...e.byValidator.entries()].toSorted((a, b) => b[1] - a[1]).map(([validator]) => validator),
            nextUnlock: e.first + UNLOCK_DAYS * DAY_MS,
            lastUnstake: e.last,
        }))
        .toSorted((a, b) => b.xrd - a.xrd)
        .slice(0, MAX_ACCOUNTS);
    return { accounts, unattributedXrd };
}

/** What Redis holds, worked out as of now, and whether a refresh should be asked for. Never calls the Gateway. */
export async function readNetworkUnstaking(network: Network): Promise<NetworkUnstaking & { wantsRefresh: boolean }> {
    const state = await readState(network);
    const now = Date.now();
    const unstakes = state?.unstakes ?? [];
    const covered = state?.coveredFrom ?? Infinity;
    // A figure is only given once the ledger was read back far enough to be complete.
    const knownAt = (at: number) => (covered <= at - UNLOCK_DAYS * DAY_MS ? lockedAt(unstakes, at) : null);
    return {
        pending: state?.pending ?? 0,
        unbonding: knownAt(now),
        unbonding24hAgo: knownAt(now - DAY_MS),
        unbonding7dAgo: knownAt(now - UNLOCK_DAYS * DAY_MS),
        schedule: knownAt(now) !== null ? scheduleFrom(unstakes, now) : [],
        ...(knownAt(now) !== null ? accountsFrom(unstakes, now) : { accounts: [], unattributedXrd: 0 }),
        validators: state?.validators ?? 0,
        updatedAt: state?.updatedAt ?? null,
        wantsRefresh: isStale(state, now),
    };
}

/* ── Reading the Gateway ── */

interface EntityItem {
    address: string;
    details?: {
        state?: { pending_xrd_withdraw_vault?: { entity_address?: string } };
        balance?: { amount?: string };
    };
}

const chunks = <T,>(items: T[], size: number) =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

async function entityDetails(network: Network, addresses: string[]): Promise<EntityItem[]> {
    const data = await gatewayPost<{ items?: EntityItem[] }>(network, '/state/entity/details', { addresses });
    return data.items ?? [];
}

interface StreamEvent {
    name?: string;
    emitter?: { entity?: { entity_address?: string } };
    data?: { fields?: { field_name?: string; value?: string }[] };
}

interface StreamItem {
    state_version: number;
    confirmed_at?: string | null;
    round_timestamp?: string;
    receipt?: { status?: string; events?: StreamEvent[] };
}

const fieldValue = (event: StreamEvent, name: string) =>
    event.data?.fields?.find(f => f.field_name === name)?.value;

/**
 * The unstakes inside one transaction, each with the XRD it moved, its validator
 * and its account — read from the receipt's events, nothing guessed:
 *  - the XRD is the deposit into the validator's pending-withdraw vault;
 *  - the validator is that vault's owner, and the same validator emits an
 *    UnstakeEvent carrying the LSUs burned;
 *  - the account is the one that emitted a withdrawal of exactly those LSUs.
 * A validator unstaked twice in one transaction is paired in order.
 */
function unstakesOf(item: StreamItem, validatorByVault: Map<string, string>): Omit<Unstake, 'sv' | 'time'>[] {
    const events = item.receipt?.events ?? [];
    const deposits = new Map<string, number[]>();
    const units = new Map<string, string[]>();

    for (const event of events) {
        const emitter = event.emitter?.entity?.entity_address;
        if (!emitter) continue;
        if (event.name?.includes('DepositEvent')) {
            const validator = validatorByVault.get(emitter);
            const amount = parseFloat(fieldValue(event, 'amount') ?? '');
            if (validator && amount > 0) deposits.set(validator, [...(deposits.get(validator) ?? []), amount]);
        } else if (event.name?.includes('UnstakeEvent') && emitter.startsWith('validator_')) {
            const burned = fieldValue(event, 'stake_units');
            if (burned) units.set(emitter, [...(units.get(emitter) ?? []), burned]);
        }
    }

    const accountWithdrawing = (burned: string | undefined) => {
        if (!burned) return null;
        const withdrawal = events.find(e =>
            e.name?.includes('WithdrawEvent')
            && e.emitter?.entity?.entity_address?.startsWith('account_')
            && e.data?.fields?.some(f => f.value === burned));
        return withdrawal?.emitter?.entity?.entity_address ?? null;
    };

    return [...deposits.entries()].flatMap(([validator, amounts]) =>
        amounts.map((xrd, i) => ({ xrd, validator, account: accountWithdrawing(units.get(validator)?.[i]) })));
}

async function unstakePage(network: Network, limit: number, cursor?: string) {
    return gatewayPost<{ items?: StreamItem[]; next_cursor?: string | null }>(network, '/stream/transactions', {
        limit_per_page: limit,
        cursor,
        kind_filter: 'User',
        manifest_class_filter: { class: 'ValidatorUnstake', match_only_most_specific: false },
        opt_ins: { receipt_events: true, confirmed_at: true },
    });
}

/**
 * Reads unstake transactions newest first: the ones since the last refresh, or on
 * the first run as far back as the horizon, within the page budget (what is left is
 * resumed by the next refresh). Failed transactions moved no XRD and are skipped.
 */
async function readUnstakes(network: Network, state: UnstakingState, now: number, pause: () => Promise<void>) {
    const validatorByVault = new Map(Object.entries(state.vaults).map(([validator, vault]) => [vault, validator]));
    const horizon = now - KEEP_MS;
    const added: Unstake[] = [];
    /** Transactions already taken in this run: the catch-up and a backfill can both reach one. */
    const seen = new Set<number>();
    let newest = state.lastSeen;
    let pages = 0;

    /** Reads pages from `cursor`; returns where it stopped and why. */
    const walk = async (cursor: string | undefined, stopAt: number | undefined, size: number) => {
        let next = cursor;
        for (;;) {
            if (pages >= MAX_PAGES_PER_REFRESH) return { cursor: next, reachedEnd: false };
            if (pages > 0) await pause();
            pages++;
            const page = await unstakePage(network, size, next);
            for (const item of page.items ?? []) {
                const time = Date.parse(item.confirmed_at ?? item.round_timestamp ?? '');
                if (stopAt !== undefined && item.state_version <= stopAt) return { cursor: undefined, reachedEnd: true };
                if (Number.isNaN(time)) continue;
                newest = Math.max(newest ?? 0, item.state_version);
                if (time < horizon) return { cursor: undefined, reachedEnd: true };
                state.coveredFrom = Math.min(state.coveredFrom ?? Infinity, time);
                if (item.receipt?.status !== 'CommittedSuccess') continue;
                if (seen.has(item.state_version)) continue;
                seen.add(item.state_version);
                for (const part of unstakesOf(item, validatorByVault)) added.push({ sv: item.state_version, time, ...part });
            }
            if (!page.next_cursor) return { cursor: undefined, reachedEnd: true };
            next = page.next_cursor;
        }
    };

    if (state.lastSeen === undefined) {
        // First run: newest to oldest, resumed by later refreshes if the budget runs out.
        const result = await walk(undefined, undefined, BACKFILL_PAGE);
        state.backfill = result.cursor ? { cursor: result.cursor } : undefined;
    } else {
        const caught = await walk(undefined, state.lastSeen, PAGE);
        // More new unstakes than the budget covers (the service was idle for long): the rest is read like a backfill.
        if (!caught.reachedEnd && caught.cursor) state.backfill = { cursor: caught.cursor };
        if (state.backfill) {
            const result = await walk(state.backfill.cursor, undefined, BACKFILL_PAGE);
            state.backfill = result.cursor ? { cursor: result.cursor } : undefined;
        }
    }
    // Once the ledger was read as far as the horizon (or to its start), the history is complete.
    if (!state.backfill) state.coveredFrom = Math.min(state.coveredFrom ?? Infinity, horizon);

    state.lastSeen = newest;
    // A transaction read again (a backfill overlapping what is known) is not added twice.
    const known = new Set(state.unstakes.map(u => u.sv));
    state.unstakes = [...state.unstakes, ...added.filter(u => !known.has(u.sv))]
        .filter(u => u.time >= horizon)
        .toSorted((a, b) => b.sv - a.sv);
}

/**
 * Refreshes the figures when they are more than 15 minutes old, or the first
 * reading is unfinished. Safe to call from anywhere, any number of times: one
 * refresh runs at a time (a lock), fresh figures cost one Redis read, and a
 * Gateway 429 postpones the next try by the Gateway's own Retry-After while the
 * last figures keep being served.
 */
export async function refreshNetworkUnstaking(network: Network): Promise<'fresh' | 'busy' | 'refreshed' | 'rate-limited' | 'failed'> {
    const before = await readState(network);
    if (!isStale(before)) return 'fresh';
    if (!(await takeLock(network, LOCK_SECONDS))) return 'busy';

    const state = before ? { ...before, vaults: { ...before.vaults } } : emptyState();
    const pause = () => new Promise<void>(resolve => setTimeout(resolve, REQUEST_GAP_MS));

    try {
        const { validators } = await getValidatorsCached(network);
        const addresses = validators.map(v => v.address);

        // 1. Vault addresses of validators not seen before (once per validator, ever).
        const unknown = addresses.filter(address => !state.vaults[address]);
        for (const [i, batch] of chunks(unknown, BATCH).entries()) {
            if (i > 0) await pause();
            for (const item of await entityDetails(network, batch)) {
                const vault = item.details?.state?.pending_xrd_withdraw_vault?.entity_address;
                if (vault) state.vaults[item.address] = vault;
            }
        }

        // 2. Their balances. The figure is only replaced when every vault was read,
        //    so a partial read can never look like XRD leaving the queue.
        const known = new Set(addresses);
        const vaults = Object.entries(state.vaults).filter(([validator]) => known.has(validator)).map(([, vault]) => vault);
        let pending = 0;
        for (const [i, batch] of chunks(vaults, BATCH).entries()) {
            if (i > 0 || unknown.length > 0) await pause();
            for (const item of await entityDetails(network, batch)) {
                pending += parseFloat(item.details?.balance?.amount ?? '0') || 0;
            }
        }
        state.pending = pending;
        state.validators = vaults.length;
        state.updatedAt = Date.now();
        // The vault figure is already worth keeping if reading the unstakes fails next.
        await writeState(network, state);

        // 3. The unstakes, to say how much of it is still locked and when it unlocks.
        await pause();
        await readUnstakes(network, state, Date.now(), pause);
        await writeState(network, state);

        logger.info({ network, validators: vaults.length, pending, unstakes: state.unstakes.length, backfilling: !!state.backfill }, '[NetworkUnstaking] Refreshed');
        return 'refreshed';
    } catch (err) {
        const status = (err as { status?: number }).status;
        // Whatever was found is kept for the next try.
        await writeState(network, state).catch(() => undefined);
        if (status === 429) {
            const retryAfter = Number((err as { headers?: Record<string, string> }).headers?.['retry-after']);
            await extendLock(network, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30) + 5);
            logger.warn({ network, retryAfter }, '[NetworkUnstaking] Gateway asked to slow down');
            return 'rate-limited';
        }
        logger.error({ err, network }, '[NetworkUnstaking] Refresh failed');
        return 'failed';
    }
}
