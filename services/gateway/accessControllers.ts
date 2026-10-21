import logger from '@/lib/logger';
import { ownerBadgeLocalId } from '@/features/console/lib/account-security';
import { GATEWAY_BASES } from './bases';
import { fetchKnownAddresses } from './knownAddresses';
import { assertNotRateLimited, createScanStore, RateLimited } from './rankingStore';
import type { Network } from './client';

/*
 * The accounts whose owner badge sits in an Access Controller — the accounts
 * that are "shielded".
 *
 * The Gateway cannot list Access Controllers, but it can list the transactions
 * that touch the account owner badge resource, and securifying an account is
 * one of them: about 760 on mainnet since 2024, 20 of which involve an Access
 * Controller. So the list is built by reading that stream and keeping the
 * accounts of the transactions that name a controller, then confirming each one
 * where its badge actually is NOW (the badge's local id is the account's own
 * node id, so no search is needed): a controller that was set up and later
 * emptied does not count.
 *
 * Like the other background rankings, it is a SCAN advanced a little at a time
 * (`advanceAccessControllers`), its progress in one Redis blob, readers never
 * touching the Gateway. The first scan is a handful of requests; after that it
 * only reads what is new since the last one (`from` state version) and checks
 * again the accounts it already holds.
 */

/** Transactions per request. */
const PAGE = 100;
/** Stream pages read per step. */
const PAGES_PER_STEP = 3;
/** Pause between requests inside a step. */
const REQUEST_GAP_MS = 600;
/** Minimum time between steps. */
const STEP_INTERVAL_S = 15;
/** A finished list is brought up to date after this long: securifying an account is rare. */
const FRESH_MS = 30 * 60 * 1000;
/** Ids per location request: the Gateway's maximum. */
const LOCATION_BATCH = 100;

export interface ShieldedAccount {
    address: string;
    /** The Access Controller that holds its owner badge. */
    controller: string;
    /** State version of the latest transaction that touched its badge: orders newest first. */
    stateVersion: number;
}

interface Scan {
    /** Where the stream stopped, while it has not reached the end. */
    cursor?: string;
    /** Resume point of an incremental scan: first state version not read yet. */
    from?: number;
    /** Confirmed accounts so far, including those the previous list still holds. */
    found: ShieldedAccount[];
    /** Highest state version read. */
    last: number;
}

interface State {
    /** The last finished list. */
    accounts: ShieldedAccount[];
    updatedAt?: number;
    /** Highest state version that list covers. */
    last: number;
    scan?: Scan;
}

export interface AccessControllerList {
    accounts: ShieldedAccount[];
    /** True while the first scan has not finished. */
    partial: boolean;
}

const store = createScanStore<State>('ac');

const newestFirst = (accounts: Iterable<ShieldedAccount>) =>
    [...accounts].toSorted((a, b) => b.stateVersion - a.stateVersion || a.address.localeCompare(b.address));

const needsWork = (state: State | null, now = Date.now()) =>
    !state || !!state.scan || !state.updatedAt || now - state.updatedAt > FRESH_MS;

/* ── Reading ── */

/** What to show now, and whether a further step should be asked for. Never calls the Gateway. */
export async function readAccessControllers(network: Network): Promise<AccessControllerList & { wantsStep: boolean }> {
    const state = await store.read(network);
    const wantsStep = needsWork(state);
    if (state?.updatedAt) return { accounts: state.accounts, partial: false, wantsStep };
    return { accounts: newestFirst(state?.scan?.found ?? []), partial: true, wantsStep };
}

/* ── Scanning ── */

interface StreamPage {
    items?: { state_version: number; affected_global_entities?: string[] }[];
    next_cursor?: string | null;
}

async function post<T>(network: Network, path: string, body: unknown): Promise<T> {
    const res = await fetch(`${GATEWAY_BASES[network]}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
    });
    assertNotRateLimited(res);
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    return res.json() as Promise<T>;
}

const wait = () => new Promise(resolve => setTimeout(resolve, REQUEST_GAP_MS));

/** Of these accounts, those whose owner badge is in an Access Controller right now, with that controller. */
async function locate(network: Network, badge: string, addresses: string[]): Promise<Map<string, string>> {
    const idOf = new Map<string, string>();
    for (const address of addresses) {
        const id = ownerBadgeLocalId(address);
        if (id) idOf.set(id, address);
    }
    const ids = [...idOf.keys()];
    const shielded = new Map<string, string>();

    for (let i = 0; i < ids.length; i += LOCATION_BATCH) {
        if (i > 0) await wait();
        const data = await post<{ non_fungible_ids?: { non_fungible_id: string; owning_vault_global_ancestor_address?: string }[] }>(
            network, '/state/non-fungible/location',
            { resource_address: badge, non_fungible_ids: ids.slice(i, i + LOCATION_BATCH) },
        );
        for (const item of data.non_fungible_ids ?? []) {
            const holder = item.owning_vault_global_ancestor_address;
            const address = idOf.get(item.non_fungible_id);
            if (address && holder?.startsWith('accesscontroller_')) shielded.set(address, holder);
        }
    }
    return shielded;
}

/**
 * Advances the scan by a few pages — or starts a new one when the list is old.
 * Safe to call from anywhere, any number of times: at most one step runs per
 * interval, and a fresh list costs one Redis read.
 */
export async function advanceAccessControllers(network: Network): Promise<'fresh' | 'busy' | 'advanced' | 'finished' | 'rate-limited' | 'failed'> {
    const before = await store.read(network);
    if (!needsWork(before)) return 'fresh';
    if (!(await store.takeLock(network, STEP_INTERVAL_S))) return 'busy';

    try {
        const badge = (await fetchKnownAddresses(network)).account_owner_badge;
        if (!badge) throw new Error('no account owner badge in the network configuration');

        let scan: Scan;
        if (before?.scan) {
            scan = before.scan;
        } else {
            // A new cycle: what the last list held is checked again, then only what is new is read.
            const previous = before?.accounts ?? [];
            const still = previous.length > 0 ? await locate(network, badge, previous.map(a => a.address)) : new Map<string, string>();
            scan = {
                from: before?.updatedAt ? before.last + 1 : undefined,
                found: previous.filter(a => still.has(a.address)).map(a => ({ ...a, controller: still.get(a.address)! })),
                last: before?.last ?? 0,
            };
        }

        const found = new Map(scan.found.map(a => [a.address, a]));
        let { cursor, last } = scan;
        let finished = false;
        let limited: RateLimited | null = null;

        try {
            for (let n = 0; n < PAGES_PER_STEP; n++) {
                if (n > 0) await wait();
                const page: StreamPage = await post<StreamPage>(network, '/stream/transactions', {
                    limit_per_page: PAGE,
                    order: 'Asc',
                    affected_global_entities_filter: [badge],
                    // A cursor continues the same query, so the starting point is sent with it too.
                    ...(scan.from ? { from_ledger_state: { state_version: scan.from } } : {}),
                    ...(cursor ? { cursor } : {}),
                    opt_ins: { affected_global_entities: true, receipt_events: false },
                });

                // Only a transaction that names a controller can have put a badge in one.
                const seen = new Map<string, number>();
                for (const tx of page.items ?? []) {
                    last = Math.max(last, tx.state_version);
                    const entities = tx.affected_global_entities ?? [];
                    if (!entities.some(e => e.startsWith('accesscontroller_'))) continue;
                    for (const e of entities) if (e.startsWith('account_')) seen.set(e, tx.state_version);
                }
                if (seen.size > 0) {
                    await wait();
                    const located = await locate(network, badge, [...seen.keys()]);
                    for (const [address, controller] of located) {
                        found.set(address, { address, controller, stateVersion: Math.max(seen.get(address) ?? 0, found.get(address)?.stateVersion ?? 0) });
                    }
                }

                cursor = page.next_cursor ?? undefined;
                if (!cursor) {
                    finished = true;
                    break;
                }
                scan = { ...scan, cursor, last, found: [...found.values()] };
            }
        } catch (err) {
            if (!(err instanceof RateLimited)) throw err;
            limited = err;
        }

        const accounts = newestFirst(found.values());
        if (finished) {
            await store.write(network, { accounts, updatedAt: Date.now(), last });
            logger.info({ network, accounts: accounts.length, lastStateVersion: last }, '[Rankings] Access Controller list complete');
            return 'finished';
        }

        // Progress is saved even when interrupted, keeping the last finished list meanwhile.
        await store.write(network, {
            accounts: before?.accounts ?? [],
            updatedAt: before?.updatedAt,
            last: before?.last ?? 0,
            scan: { ...scan, cursor, last, found: accounts },
        });
        if (limited) {
            await store.extendLock(network, limited.retryAfter + 5);
            logger.warn({ network, retryAfter: limited.retryAfter }, '[Rankings] Gateway asked to slow down; next step postponed');
            return 'rate-limited';
        }
        return 'advanced';
    } catch (err) {
        if (err instanceof RateLimited) {
            // The re-check at the start of a cycle: nothing saved yet, just wait.
            await store.extendLock(network, err.retryAfter + 5);
            return 'rate-limited';
        }
        logger.error({ err, network }, '[Rankings] Access Controller scan step failed');
        return 'failed';
    }
}
