import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { withRetry } from '@/services/gateway/client';
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/features/dashboard/types';

/**
 * How many full years each account had been on the ledger at a given moment.
 *
 * Voting rules only need whole years (at least one, at least two…), so the
 * ledger is asked how every account stood one, two… years before that moment:
 * an account that already held something back then was at least that old.
 * That takes one request per 20 accounts and year instead of one per account,
 * which keeps a vote with hundreds of voters under the Gateway's rate limit.
 */

const DAY = 86_400;
const YEAR = 365 * DAY;
/** Babylon genesis: nothing on this ledger is older. */
const GENESIS: Record<Network, number> = { mainnet: Date.parse('2023-09-28T00:00:00Z') / 1000, stokenet: Date.parse('2023-09-28T00:00:00Z') / 1000 };
const XRD_ADDRESS: Record<Network, string> = {
    mainnet: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    stokenet: 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
};
const MAX_YEARS = 5;
/** Checkpoints (days before vote opening) used for 90-day TWAB and minimum held balance. */
const TWAB_OFFSETS_DAYS = [0, 30, 60, 90] as const;
/** Addresses the Gateway accepts per entity details request. */
const PER_REQUEST = 20;
/** Gateway requests in flight at once from this instance. */
const MAX_IN_FLIGHT = 8;

let inFlight = 0;
const waiting: Array<() => void> = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
    if (inFlight >= MAX_IN_FLIGHT) await new Promise<void>(resolve => waiting.push(resolve));
    inFlight++;
    try {
        return await fn();
    } finally {
        inFlight--;
        waiting.shift()?.();
    }
}

interface DetailsPage {
    items?: Array<{
        address?: string;
        details?: { total_supply?: string };
        fungible_resources?: {
            total_count?: number | null;
            items?: Array<{ resource_address?: string; amount?: string }>;
        };
        non_fungible_resources?: { total_count?: number | null };
    }>;
}

interface ValidatorsPage {
    validators?: {
        items?: Array<{
            stake_vault?: { balance?: string };
            state?: { stake_unit_resource_address?: string };
        }>;
        next_cursor?: string | null;
    };
}

export interface AccountHistoryBatch {
    years: Record<string, number>;
    stakedXrd: Record<string, number>;
    twab90Xrd: Record<string, number>;
    min90Xrd: Record<string, number>;
}

/** Accounts of `accounts` that held any resource at `timestamp`. A past state never changes: cached for good. */
async function existedAt(network: Network, timestamp: string, accounts: string[]): Promise<string[]> {
    'use cache';
    cacheLife('max');
    cacheTag('account-ages');
    const res = await withRetry(() => limited(() => gatewayPost<DetailsPage>(network, '/state/entity/details', {
        addresses: accounts,
        at_ledger_state: { timestamp },
    })), 4);
    return (res.items ?? [])
        .filter(it => (it.fungible_resources?.total_count ?? 0) > 0 || (it.non_fungible_resources?.total_count ?? 0) > 0)
        .flatMap(it => (it.address ? [it.address] : []));
}

/** Map of LSU resource address -> XRD per LSU at `timestamp`. Cached forever for past states. */
async function lsuRatesAt(network: Network, timestamp: string): Promise<Record<string, number>> {
    'use cache';
    cacheLife('max');
    cacheTag('account-ages');
    const stakedByLsu = new Map<string, number>();
    let cursor: string | undefined;
    do {
        const page = await withRetry(() => limited(() => gatewayPost<ValidatorsPage>(network, '/state/validators/list', {
            at_ledger_state: { timestamp },
            ...(cursor ? { cursor } : {}),
        })), 4);
        for (const v of page.validators?.items ?? []) {
            const lsu = v.state?.stake_unit_resource_address;
            const bal = parseFloat(v.stake_vault?.balance ?? '0');
            if (lsu && Number.isFinite(bal) && bal > 0) stakedByLsu.set(lsu, bal);
        }
        cursor = page.validators?.next_cursor ?? undefined;
    } while (cursor);

    const rates: Record<string, number> = {};
    const lsuAddrs = [...stakedByLsu.keys()].sort();
    const chunks: string[][] = [];
    for (let i = 0; i < lsuAddrs.length; i += PER_REQUEST) {
        chunks.push(lsuAddrs.slice(i, i + PER_REQUEST));
    }
    const pages = await Promise.all(
        chunks.map(chunk =>
            withRetry(() => limited(() => gatewayPost<DetailsPage>(network, '/state/entity/details', {
                addresses: chunk,
                at_ledger_state: { timestamp },
            })), 4),
        ),
    );
    for (const res of pages) {
        for (const it of res.items ?? []) {
            if (!it.address) continue;
            const supply = parseFloat(it.details?.total_supply ?? '0');
            const stake = stakedByLsu.get(it.address) ?? 0;
            if (Number.isFinite(supply) && supply > 0 && stake > 0) {
                rates[it.address] = stake / supply;
            }
        }
    }
    return rates;
}

/** Raw liquid XRD + non-XRD fungible balances per account at `timestamp`, cached permanently without depending on `lsuRates`. */
async function fungibleBalancesAt(
    network: Network,
    timestamp: string,
    accounts: string[],
): Promise<Record<string, { liquid: number; nonXrd: Record<string, number> }>> {
    'use cache';
    cacheLife('max');
    cacheTag('account-ages');
    const xrdAddr = XRD_ADDRESS[network];
    const res = await withRetry(() => limited(() => gatewayPost<DetailsPage>(network, '/state/entity/details', {
        addresses: accounts,
        aggregation_level: 'Global',
        at_ledger_state: { timestamp },
    })), 4);
    const out: Record<string, { liquid: number; nonXrd: Record<string, number> }> = {};
    for (const it of res.items ?? []) {
        if (!it.address) continue;
        let liquid = 0;
        const nonXrd: Record<string, number> = {};
        for (const f of it.fungible_resources?.items ?? []) {
            if (!f.resource_address || !f.amount) continue;
            const amt = parseFloat(f.amount);
            if (!Number.isFinite(amt) || amt <= 0) continue;
            if (f.resource_address === xrdAddr) {
                liquid += amt;
            } else {
                nonXrd[f.resource_address] = (nonXrd[f.resource_address] ?? 0) + amt;
            }
        }
        out[it.address] = { liquid, nonXrd };
    }
    return out;
}

/** Full years on the ledger of each account at `atSec` (unix seconds), from 0 up to MAX_YEARS. */
async function fetchAgeYears(network: Network, atSec: number, accounts: string[]): Promise<Record<string, number>> {
    const years: Record<string, number> = Object.fromEntries(accounts.map(a => [a, 0]));
    // Only an account that existed a year back can have existed two years back, and so on.
    let candidates = [...accounts].sort();
    for (let k = 1; k <= MAX_YEARS && candidates.length; k++) {
        const cutoff = atSec - k * YEAR;
        if (cutoff < GENESIS[network]) break;
        const timestamp = new Date(cutoff * 1000).toISOString().slice(0, 10) + 'T00:00:00Z';
        const chunks: string[][] = [];
        for (let i = 0; i < candidates.length; i += PER_REQUEST) {
            chunks.push(candidates.slice(i, i + PER_REQUEST));
        }
        const results = await Promise.all(chunks.map(chunk => existedAt(network, timestamp, chunk)));
        const older = results.flat();
        for (const a of older) years[a] = k;
        candidates = older;
    }
    return years;
}

/**
 * Historical account metrics at vote opening (`atSec`):
 * - `years`: full years on the ledger (0..MAX_YEARS)
 * - `stakedXrd`: XRD staked in validators at vote opening
 * - `twab90Xrd`: 90-day time-weighted average XRD (liquid + staked) across 4 checkpoints
 * - `min90Xrd`: minimum XRD (liquid + staked) continuously held across all 90-day checkpoints
 */
export async function fetchAccountHistory(network: Network, atSec: number, accounts: string[]): Promise<AccountHistoryBatch> {
    const sorted = [...accounts].sort();
    const openingTs = new Date(atSec * 1000).toISOString();
    const accountChunks: string[][] = [];
    for (let i = 0; i < sorted.length; i += PER_REQUEST) {
        accountChunks.push(sorted.slice(i, i + PER_REQUEST));
    }

    // Run age lookup, LSU exchange rates, and all 4 TWAB balance checkpoints concurrently.
    const [years, lsuRates, checkpointSnaps] = await Promise.all([
        fetchAgeYears(network, atSec, sorted),
        atSec >= GENESIS[network] ? lsuRatesAt(network, openingTs) : Promise.resolve<Record<string, number>>({}),
        Promise.all(
            TWAB_OFFSETS_DAYS.map(async offsetDays => {
                const tsSec = atSec - offsetDays * DAY;
                if (tsSec < GENESIS[network]) return { offsetDays, snap: null };
                const timestamp = offsetDays === 0
                    ? openingTs
                    : new Date(tsSec * 1000).toISOString().slice(0, 10) + 'T00:00:00Z';
                const parts = await Promise.all(
                    accountChunks.map(chunk => fungibleBalancesAt(network, timestamp, chunk)),
                );
                const merged: Record<string, { liquid: number; nonXrd: Record<string, number> }> = {};
                for (const part of parts) Object.assign(merged, part);
                return { offsetDays, snap: merged };
            }),
        ),
    ]);

    const stakedXrd: Record<string, number> = Object.fromEntries(sorted.map(a => [a, 0]));
    const totalsByAccount: Record<string, number[]> = Object.fromEntries(sorted.map(a => [a, []]));

    for (const { offsetDays, snap } of checkpointSnaps) {
        if (!snap) {
            for (const a of sorted) totalsByAccount[a].push(0);
            continue;
        }
        for (const a of sorted) {
            const entry = snap[a];
            let liquid = 0;
            let staked = 0;
            if (entry) {
                liquid = entry.liquid;
                for (const [resAddr, amt] of Object.entries(entry.nonXrd)) {
                    const rate = lsuRates[resAddr];
                    if (rate) staked += amt * rate;
                }
            }
            if (offsetDays === 0) stakedXrd[a] = staked;
            totalsByAccount[a].push(liquid + staked);
        }
    }

    const twab90Xrd: Record<string, number> = {};
    const min90Xrd: Record<string, number> = {};
    for (const a of sorted) {
        const samples = totalsByAccount[a];
        twab90Xrd[a] = samples.length ? samples.reduce((s, x) => s + x, 0) / samples.length : 0;
        min90Xrd[a] = samples.length ? Math.min(...samples) : 0;
    }

    return { years, stakedXrd, twab90Xrd, min90Xrd };
}
