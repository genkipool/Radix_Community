import { sanitizeText } from '@/utils/sanitize';
import type { GatewayEvent } from '@/features/dashboard/types';
import type { BalanceChanges, FungibleChange } from '../types';

/** Assets an account took out and put back into itself in the same transaction. */
export interface SelfTransfer {
    account: string;
    resource: string;
    /** Fungible amount moved (withdrawn and deposited back). */
    amount?: number;
    /** Non-fungible ids moved. */
    ids?: string[];
}

type Field = { kind?: string; type_name?: string; value?: unknown; elements?: Field[] };

/** Resource and what moved, from an account's Withdraw/Deposit event. */
const readMove = (event: GatewayEvent): { resource: string; amount?: number; ids?: string[] } | null => {
    const fields = (event.data?.fields ?? []) as Field[];
    const resource = fields.find((f) => f.type_name === 'ResourceAddress' || (typeof f.value === 'string' && f.value.startsWith('resource_')))?.value;
    if (typeof resource !== 'string') return null;
    const amount = fields.find((f) => f.kind === 'Decimal')?.value;
    if (amount !== undefined) return { resource: sanitizeText(resource), amount: Number(amount) };
    const ids = fields.find((f) => f.kind === 'Array')?.elements?.map((e) => String(e.value));
    return ids ? { resource: sanitizeText(resource), ids } : null;
};

/**
 * Moves the Gateway's balance changes cannot show: an account withdraws an
 * asset and deposits the same amount (or the same NFTs) back into itself, so
 * its balance does not change and only the fee is left. Read from the
 * Withdraw/Deposit events accounts emit; a pair whose net does show up in the
 * balance changes (a partial refund, a swap) is left to the transfer cards.
 */
export function extractSelfTransfers(events: GatewayEvent[], balanceChanges?: BalanceChanges): SelfTransfer[] {
    const changed = new Set([
        ...(balanceChanges?.fungible_balance_changes ?? []).map((c) => `${c.entity_address}|${c.resource_address}`),
        ...(balanceChanges?.non_fungible_balance_changes ?? []).map((c) => `${c.entity_address}|${c.resource_address}`),
    ]);
    const moves = new Map<string, { out: number; in: number; idsOut: Set<string>; idsIn: Set<string> }>();
    for (const event of events) {
        if (event.name !== 'WithdrawEvent' && event.name !== 'DepositEvent') continue;
        const account = sanitizeText(event.emitter?.entity?.entity_address || '');
        if (!account.startsWith('account_')) continue;
        const move = readMove(event);
        if (!move) continue;
        const key = `${account}|${move.resource}`;
        const entry = moves.get(key) ?? { out: 0, in: 0, idsOut: new Set<string>(), idsIn: new Set<string>() };
        const withdraw = event.name === 'WithdrawEvent';
        if (move.amount !== undefined) entry[withdraw ? 'out' : 'in'] += move.amount;
        for (const id of move.ids ?? []) entry[withdraw ? 'idsOut' : 'idsIn'].add(id);
        moves.set(key, entry);
    }
    const result: SelfTransfer[] = [];
    for (const [key, entry] of moves) {
        if (changed.has(key)) continue;
        const [account, resource] = key.split('|');
        if (entry.out > 0 && entry.in > 0) result.push({ account, resource, amount: Math.min(entry.out, entry.in) });
        const ids = [...entry.idsOut].filter((id) => entry.idsIn.has(id));
        if (ids.length > 0) result.push({ account, resource, ids });
    }
    return result;
}

/**
 * Self-transfers as the balance changes the transfer cards read: the account
 * on both sides, what it withdrew as the sent side and what it deposited back
 * as the received side, plus the transaction's real fee. One group per asset.
 */
export function selfTransferCards(moves: SelfTransfer[], balanceChanges?: BalanceChanges): { balanceChanges: BalanceChanges; groups: FungibleChange[][] } {
    const fungibles = moves.filter((m) => m.amount !== undefined);
    const nfts = moves.filter((m) => m.ids);
    const synthetic: BalanceChanges = {
        ...balanceChanges,
        fungible_fee_balance_changes: balanceChanges?.fungible_fee_balance_changes ?? [],
        fungible_balance_changes: fungibles.flatMap((m) => [
            { entity_address: m.account, resource_address: m.resource, balance_change: String(-(m.amount ?? 0)) },
            { entity_address: m.account, resource_address: m.resource, balance_change: String(m.amount) },
        ]),
        non_fungible_balance_changes: nfts.map((m) => ({ entity_address: m.account, resource_address: m.resource, added: m.ids ?? [], removed: m.ids ?? [] })),
    };
    const groups: FungibleChange[][] = [
        ...fungibles.map((m) => synthetic.fungible_balance_changes!.filter((c) => c.entity_address === m.account && c.resource_address === m.resource)),
        ...nfts.map((m) => [{ entity_address: m.account, resource_address: m.resource, balance_change: '0' }]),
    ];
    return { balanceChanges: synthetic, groups };
}
