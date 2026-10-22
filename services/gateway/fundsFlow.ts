import logger from '@/lib/logger';
import { getXrdAddress } from '@/features/dashboard/explorador/constants';
import {
    classifyDestination, forwardingPattern, summarizeFunds,
    type DestinationKind, type FlowItem, type FundsFlow,
} from '@/features/dashboard/explorador/utils/fundsFlow';
import { withRetry, type Network } from './client';
import { gatewayRestBase } from './validatorList';

/** Transactions per Gateway page, and how many pages an account's flow reads: its latest 300. */
const PAGE = 100;
const FLOW_PAGES = 3;
/** The biggest places the account sent XRD to that are looked into, and how far back each is read. */
const DESTINATIONS_LOOKED_INTO = 3;

type StreamPage = { items?: FlowItem[]; next_cursor?: string | null };

/** Newest first, the pages of an account's transactions with their balance changes. */
async function readTransactions(address: string, network: Network, pages: number): Promise<{ items: FlowItem[]; more: boolean }> {
    const base = gatewayRestBase(network);
    const items: FlowItem[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < pages; i++) {
        const page: StreamPage = await withRetry(async () => {
            const res = await fetch(`${base}/stream/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    affected_global_entities_filter: [address],
                    opt_ins: { balance_changes: true },
                    limit_per_page: PAGE,
                    ...(cursor ? { cursor } : {}),
                }),
            });
            if (!res.ok) throw Object.assign(new Error(`Gateway ${res.status}`), { status: res.status });
            return res.json() as Promise<StreamPage>;
        });
        items.push(...(page.items ?? []));
        cursor = page.next_cursor ?? undefined;
        if (!cursor) return { items, more: false };
    }
    return { items, more: true };
}

export interface AccountFunds extends FundsFlow {
    /** The latest transactions were not all of them: the account has older ones. */
    more: boolean;
}

export async function readFundsFlow(address: string, network: Network): Promise<AccountFunds> {
    const { items, more } = await readTransactions(address, network, FLOW_PAGES);
    return { ...summarizeFunds(address, items, getXrdAddress(network)), more };
}

export interface DestinationHint {
    kind: DestinationKind;
    /** Where it passes the XRD on to, when it does. */
    hub: string | null;
    /** Share of what it received that it passed to that one place (0–1). */
    share: number;
    /** Distinct addresses that fed the hub in what was read of its history. */
    hubSenders: number;
}

/**
 * What the account's biggest destinations do with the XRD they are given: for
 * each, its latest transactions and those of the place it passes the XRD on to.
 * A handful of reads, so it is a request of its own, after the flow is shown.
 */
export async function readDestinationHints(address: string, network: Network): Promise<Record<string, DestinationHint>> {
    const xrd = getXrdAddress(network);
    const { items } = await readTransactions(address, network, FLOW_PAGES);
    const targets = summarizeFunds(address, items, xrd).counterparties
        .filter(c => c.sent > 0 && c.address.startsWith('account_'))
        .toSorted((a, b) => b.sent - a.sent)
        .slice(0, DESTINATIONS_LOOKED_INTO);

    const entries = await Promise.all(targets.map(async ({ address: target }) => {
        const own = await readTransactions(target, network, 1);
        const pattern = forwardingPattern(target, own.items, xrd);
        let hubFacts: { senders: number; txs: number } | null = null;
        if (pattern.hub?.startsWith('account_') && pattern.share > 0.7) {
            const hub = await readTransactions(pattern.hub, network, 1);
            hubFacts = { senders: forwardingPattern(pattern.hub, hub.items, xrd).senders, txs: hub.items.length };
        }
        const hint: DestinationHint = {
            kind: classifyDestination(pattern, hubFacts),
            hub: pattern.hub,
            share: pattern.share,
            hubSenders: hubFacts?.senders ?? 0,
        };
        return [target, hint] as const;
    }));
    return Object.fromEntries(entries);
}

const FRESH_MS = 120_000;
const cache = new Map<string, { at: number; value: unknown }>();
const reading = new Map<string, Promise<unknown>>();

/** One read per key at a time, and the answer kept for two minutes: a crowd on one account asks the Gateway once. */
export async function shared<T>(key: string, read: () => Promise<T>): Promise<T> {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < FRESH_MS) return cached.value as T;
    let pending = reading.get(key) as Promise<T> | undefined;
    if (!pending) {
        pending = read()
            .then(value => {
                cache.set(key, { at: Date.now(), value });
                // A busy server must not grow this without end.
                if (cache.size > 200) cache.delete(cache.keys().next().value as string);
                return value;
            })
            .catch(err => {
                logger.error({ err, key }, '[fundsFlow] Read failed: %s', err instanceof Error ? err.message : String(err));
                throw err;
            })
            .finally(() => reading.delete(key));
        reading.set(key, pending);
    }
    return pending;
}
