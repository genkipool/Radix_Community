/*
 * Where an account's XRD comes from and where it goes, worked out from the
 * balance changes of its transactions. Pure: the Gateway is read in
 * services/gateway/fundsFlow.ts and only handed over here.
 */

/** The part of a Gateway stream item this reads. */
export interface FlowItem {
    confirmed_at?: string | null;
    balance_changes?: {
        fungible_balance_changes?: { entity_address: string; resource_address: string; balance_change: string }[];
    } | null;
}

/** One side of the account's dealings with another address. */
export interface Counterparty {
    address: string;
    /** XRD that came from it. */
    received: number;
    /** XRD that went to it. */
    sent: number;
    /** Transactions the two shared with a movement between them. */
    txs: number;
    lastAt: string | null;
}

export interface FundsFlow {
    counterparties: Counterparty[];
    received: number;
    sent: number;
    /** Transactions read, of which the account moved XRD in `moved`. */
    txs: number;
    moved: number;
    /** Newest and oldest transaction read. */
    to: string | null;
    from: string | null;
}

/** Movements smaller than this are noise: fee dust, rounding. */
const DUST = 0.01;

interface Leg {
    counterparty: string;
    amount: number;
    /** True when the account is the one that received. */
    incoming: boolean;
    at: string | null;
}

/**
 * The XRD movements of one account, one entry per counterparty of each
 * transaction. A transaction is a set of net balance changes with no pairing
 * between who paid and who was paid, so the account's change is shared out
 * between the opposite-signed changes in proportion to their size: nothing is
 * counted twice when several parties are on the other side.
 */
export function xrdLegs(address: string, items: FlowItem[], xrd: string): Leg[] {
    const legs: Leg[] = [];
    for (const item of items) {
        const changes = (item.balance_changes?.fungible_balance_changes ?? []).filter(c => c.resource_address === xrd);
        const own = changes.filter(c => c.entity_address === address).reduce((sum, c) => sum + Number(c.balance_change), 0);
        if (!Number.isFinite(own) || Math.abs(own) < DUST) continue;
        const opposite = changes.filter(c => c.entity_address !== address && Math.sign(Number(c.balance_change)) === -Math.sign(own));
        const total = opposite.reduce((sum, c) => sum + Math.abs(Number(c.balance_change)), 0);
        if (total === 0) continue;
        for (const other of opposite) {
            legs.push({
                counterparty: other.entity_address,
                amount: Math.abs(own) * (Math.abs(Number(other.balance_change)) / total),
                incoming: own > 0,
                at: item.confirmed_at ?? null,
            });
        }
    }
    return legs;
}

/** An account's counterparties, the biggest dealings first. */
export function summarizeFunds(address: string, items: FlowItem[], xrd: string): FundsFlow {
    const byAddress = new Map<string, Counterparty>();
    let moved = 0;
    for (const item of items) {
        const legs = xrdLegs(address, [item], xrd);
        if (legs.length > 0) moved += 1;
        for (const leg of legs) {
            const row = byAddress.get(leg.counterparty) ?? { address: leg.counterparty, received: 0, sent: 0, txs: 0, lastAt: null };
            if (leg.incoming) row.received += leg.amount;
            else row.sent += leg.amount;
            row.txs += 1;
            if (leg.at && (!row.lastAt || leg.at > row.lastAt)) row.lastAt = leg.at;
            byAddress.set(leg.counterparty, row);
        }
    }
    const counterparties = [...byAddress.values()].toSorted((a, b) => (b.received + b.sent) - (a.received + a.sent));
    const dates = items.map(i => i.confirmed_at).filter((d): d is string => !!d).toSorted();
    return {
        counterparties,
        received: counterparties.reduce((sum, c) => sum + c.received, 0),
        sent: counterparties.reduce((sum, c) => sum + c.sent, 0),
        txs: items.length,
        moved,
        to: dates.at(-1) ?? null,
        from: dates.at(0) ?? null,
    };
}

/** What an address does with the XRD it is given: how much it passes on, and to whom. */
export interface ForwardingPattern {
    /** Share of the XRD it received that went to its single biggest destination (0–1). */
    share: number;
    /** That destination. */
    hub: string | null;
    /** Distinct addresses that sent it XRD. */
    senders: number;
    received: number;
}

export function forwardingPattern(address: string, items: FlowItem[], xrd: string): ForwardingPattern {
    const legs = xrdLegs(address, items, xrd);
    const received = legs.filter(l => l.incoming).reduce((sum, l) => sum + l.amount, 0);
    const senders = new Set(legs.filter(l => l.incoming).map(l => l.counterparty));
    const out = new Map<string, number>();
    for (const leg of legs) if (!leg.incoming) out.set(leg.counterparty, (out.get(leg.counterparty) ?? 0) + leg.amount);
    const [hub, amount] = [...out].toSorted((a, b) => b[1] - a[1])[0] ?? [null, 0];
    return { share: received > 0 ? Math.min(1, amount / received) : 0, hub, senders: senders.size, received };
}

/** The thresholds that call a forwarding pattern a collection wallet. */
export const COLLECTOR = { share: 0.7, hubSenders: 10, hubTxs: 100 } as const;

export type DestinationKind =
    /** Passes most of what it gets to one account that many others also feed: how a deposit address behaves. */
    | 'collector'
    /** Passes most of it to something that is not an account: a pool, a validator, a component. */
    | 'onchain'
    | 'other';

/**
 * What the pattern suggests about a destination. It is a pattern and nothing
 * more: nothing on the ledger says an address belongs to an exchange.
 */
export function classifyDestination(pattern: ForwardingPattern, hub: { senders: number; txs: number } | null): DestinationKind {
    if (!pattern.hub || pattern.share <= COLLECTOR.share) return 'other';
    if (!pattern.hub.startsWith('account_')) return 'onchain';
    return hub && hub.senders >= COLLECTOR.hubSenders && hub.txs >= COLLECTOR.hubTxs ? 'collector' : 'other';
}
