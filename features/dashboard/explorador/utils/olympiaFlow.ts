/*
 * Olympia movements in the shape the funds-flow maths reads, and two flows
 * joined into one. Pure, so the server builds and the client shows the same
 * thing.
 *
 * Olympia's Gateway already paired each transfer with its counterparty
 * (`operations_by_account`), so each one becomes a two-sided balance change that
 * `summarizeFunds` (utils/fundsFlow.ts) reads exactly like a Babylon
 * transaction: nothing about the maths changes.
 */
import type { Counterparty, FlowItem, FundsFlow } from './fundsFlow';

/** One XRD movement of the account, as the Olympia dataset lists it. */
export interface OlympiaMovement {
  at: string | null;
  /** 'in' when the account received. */
  direction: 'in' | 'out';
  counterparty: string;
  /** Whole XRD, positive. */
  amount: number;
}

/** Olympia movements as funds-flow items, one per movement. */
export function movementsToFlowItems(account: string, xrd: string, moves: OlympiaMovement[]): FlowItem[] {
  return moves.map((m) => {
    const own = m.direction === 'in' ? m.amount : -m.amount;
    return {
      confirmed_at: m.at,
      balance_changes: {
        fungible_balance_changes: [
          { entity_address: account, resource_address: xrd, balance_change: String(own) },
          { entity_address: m.counterparty, resource_address: xrd, balance_change: String(-own) },
        ],
      },
    };
  });
}

/** Two flows of the same owner (e.g. its Babylon and its Olympia history) as one. */
export function mergeFunds(a: FundsFlow, b: FundsFlow): FundsFlow {
  const byAddress = new Map<string, Counterparty>();
  for (const c of [...a.counterparties, ...b.counterparties]) {
    const row = byAddress.get(c.address);
    if (!row) {
      byAddress.set(c.address, { ...c });
      continue;
    }
    row.received += c.received;
    row.sent += c.sent;
    row.txs += c.txs;
    if (c.lastAt && (!row.lastAt || c.lastAt > row.lastAt)) row.lastAt = c.lastAt;
  }
  const counterparties = [...byAddress.values()].toSorted((x, y) => (y.received + y.sent) - (x.received + x.sent));
  const dates = [a.from, a.to, b.from, b.to].filter((d): d is string => !!d).toSorted();
  return {
    counterparties,
    received: a.received + b.received,
    sent: a.sent + b.sent,
    txs: a.txs + b.txs,
    moved: a.moved + b.moved,
    to: dates.at(-1) ?? null,
    from: dates.at(0) ?? null,
  };
}
