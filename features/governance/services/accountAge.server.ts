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
const MAX_YEARS = 5;
/** Addresses the Gateway accepts per entity details request. */
const PER_REQUEST = 20;
/** Gateway requests in flight at once from this instance. */
const MAX_IN_FLIGHT = 2;

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
        fungible_resources?: { total_count?: number | null };
        non_fungible_resources?: { total_count?: number | null };
    }>;
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

/** Full years on the ledger of each account at `atSec` (unix seconds), from 0 up to MAX_YEARS. */
export async function fetchAgeYears(network: Network, atSec: number, accounts: string[]): Promise<Record<string, number>> {
    const years: Record<string, number> = Object.fromEntries(accounts.map(a => [a, 0]));
    // Only an account that existed a year back can have existed two years back, and so on.
    let candidates = [...accounts].sort();
    for (let k = 1; k <= MAX_YEARS && candidates.length; k++) {
        const cutoff = atSec - k * YEAR;
        if (cutoff < GENESIS[network]) break;
        const timestamp = new Date(cutoff * 1000).toISOString().slice(0, 10) + 'T00:00:00Z';
        const older: string[] = [];
        for (let i = 0; i < candidates.length; i += PER_REQUEST) {
            older.push(...await existedAt(network, timestamp, candidates.slice(i, i + PER_REQUEST)));
        }
        for (const a of older) years[a] = k;
        candidates = older;
    }
    return years;
}
