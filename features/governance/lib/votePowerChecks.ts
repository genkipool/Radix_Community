import { BigNumber } from './votePowerMath';

/**
 * Guards for the snapshot voting power reads. Results are cached for good,
 * so anything that could be a Gateway hiccup (a lagging node, a short page,
 * a runaway cursor) must throw instead of turning into a cached zero.
 */

/** How far before the requested time the resolved ledger state may sit. */
export const MAX_STATE_LAG_MS = 60_000;
/** Pages followed on one cursor before giving up. */
export const MAX_PAGES = 50;

/**
 * State version for `requested` (ISO) from a Gateway `ledger_state`. Throws when
 * it is not usable: a Gateway that lags resolves to its tip, well before the
 * time asked for; a pre-genesis time resolves to version 1.
 */
export function checkedStateVersion(
    requested: string,
    ledgerState: { state_version?: unknown; proposer_round_timestamp?: unknown } | undefined,
): number {
    const version = ledgerState?.state_version;
    if (typeof version !== 'number' || !Number.isFinite(version)) throw new Error('Gateway returned no state version');
    if (version <= 1) throw new Error('Snapshot is before genesis');
    const at = typeof ledgerState?.proposer_round_timestamp === 'string' ? Date.parse(ledgerState.proposer_round_timestamp) : NaN;
    if (!Number.isFinite(at)) throw new Error('Gateway returned no ledger timestamp');
    if (at < Date.parse(requested) - MAX_STATE_LAG_MS) throw new Error(`Gateway state ${new Date(at).toISOString()} lags the snapshot ${requested}`);
    return version;
}

/** Throws unless every requested address came back. */
export function requireAll<T extends { address?: string }>(requested: readonly string[], items: readonly T[], what: string): T[] {
    const got = new Set(items.map(i => i.address));
    const missing = requested.filter(a => !got.has(a));
    if (missing.length) throw new Error(`Gateway returned no ${what} for ${missing.length} of ${requested.length} addresses`);
    return [...items];
}

/**
 * Items for every requested account. One missing from a batch is asked for
 * again on its own: an account that did not exist yet at that version comes
 * back missing a second time and is reported in `absent` (power 0, as the
 * collector weighs it); an error from that lone query propagates.
 */
export async function withMissingAccounts<T extends { address?: string }>(
    requested: readonly string[],
    items: readonly T[],
    single: (address: string) => Promise<readonly T[]>,
): Promise<{ items: T[]; absent: string[] }> {
    const got = new Set(items.map(i => i.address));
    const out = [...items];
    const absent: string[] = [];
    for (const address of requested.filter(a => !got.has(a))) {
        const again = (await single(address)).find(i => i.address === address);
        if (again) out.push(again);
        else absent.push(address);
    }
    return { items: out, absent };
}

/** Throws unless `got` covers every id in `requested`. */
export function requireIds(requested: readonly string[], got: ReadonlyArray<{ non_fungible_id?: string }>): void {
    const seen = new Set(got.map(g => g.non_fungible_id));
    const missing = requested.filter(id => !seen.has(id)).length;
    if (missing) throw new Error(`Gateway returned no data for ${missing} of ${requested.length} non-fungibles`);
}

/** Follows a cursor (`first` already fetched), at most MAX_PAGES further pages. */
export async function followCursor<T>(
    first: { items: T[]; cursor: string | null | undefined },
    next: (cursor: string) => Promise<{ items?: T[]; next_cursor?: string | null }>,
    maxPages = MAX_PAGES,
): Promise<T[]> {
    const items = [...first.items];
    let cursor = first.cursor;
    let pages = 0;
    while (cursor) {
        if (++pages > maxPages) throw new Error(`More than ${maxPages} pages`);
        const page = await next(cursor);
        items.push(...(page.items ?? []));
        cursor = page.next_cursor;
    }
    return items;
}

/** Whether two exact decimals agree within `tolerance`. */
export function decimalsAgree(a: string, b: string, tolerance = '1e-9'): boolean {
    try {
        return new BigNumber(a).minus(b).abs().lte(tolerance);
    } catch {
        return false;
    }
}

/** Exact sum of decimal strings. */
export function sumDecimals(values: Iterable<string>): string {
    let total = new BigNumber(0);
    for (const v of values) total = total.plus(v);
    return total.toFixed();
}

/** Rejects when `promise` has not settled within `ms`, after calling `onDeadline` (e.g. to abort the work). */
export function withDeadline<T>(promise: Promise<T>, ms: number, onDeadline?: () => void): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            onDeadline?.();
            reject(new Error(`Timed out after ${ms} ms`));
        }, ms);
    });
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/** Account addresses of a network (the only entities whose power is computed). */
export function isAccountAddress(network: 'mainnet' | 'stokenet', address: string): boolean {
    return address.startsWith(network === 'mainnet' ? 'account_rdx1' : 'account_tdx_2_1');
}
