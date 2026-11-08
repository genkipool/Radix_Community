/**
 * services/olympia/flows.ts
 *
 * Where an Olympia account's XRD came from and where it went, computed with the
 * same maths as Babylon's funds flow (explorador/utils/fundsFlow.ts).
 */
import 'server-only';
import { OLYMPIA_XRD_RRI } from '@/features/dashboard/lib/olympia';
import { summarizeFunds, type FundsFlow } from '@/features/dashboard/explorador/utils/fundsFlow';
import { movementsToFlowItems, type OlympiaMovement } from '@/features/dashboard/explorador/utils/olympiaFlow';
import type { OlympiaAccountRef } from './accounts';
import { OLYMPIA_FILES as F } from './files';
import { toIso, toNum } from './mappers';
import { attoToNumber, readEqWithin, readPageDesc } from './parquet';

/** How many of the account's latest actions are read: whole histories of exchanges run to hundreds of thousands. */
const ACTIONS_READ = 5000;

export interface OlympiaFunds extends FundsFlow {
  more: boolean;
}

/** The account's XRD movements with other accounts, newest first. */
export async function readMovements(ref: OlympiaAccountRef, limit = ACTIONS_READ): Promise<{ moves: OlympiaMovement[]; more: boolean }> {
  const { rows, more } = await readPageDesc(F.accountOperations.path, F.accountOperations.key, ref.id, F.accountOperations.order, null, limit);
  if (rows.length === 0) return { moves: [], more: false };
  const lo = BigInt(toNum(rows[rows.length - 1].state_version));
  const hi = BigInt(toNum(rows[0].state_version));
  const txs = await readEqWithin(F.accountTxs.path, F.accountTxs.key, ref.id, F.accountTxs.order, lo, hi);
  const at = new Map(txs.map((t) => [toNum(t.state_version), toIso(t.round_timestamp)]));
  const moves: OlympiaMovement[] = [];
  for (const r of rows) {
    if (r.rri !== OLYMPIA_XRD_RRI || typeof r.counterparty_address !== 'string') continue;
    if (r.action_type !== 'SIMPLE_TRANSFER' && r.action_type !== 'COMPLEX') continue;
    const amount = attoToNumber(r.amount);
    if (!(amount > 0)) continue;
    moves.push({
      at: at.get(toNum(r.state_version)) ?? null,
      direction: r.direction === 'in' ? 'in' : 'out',
      counterparty: r.counterparty_address,
      amount,
    });
  }
  return { moves, more };
}

export async function readOlympiaFunds(ref: OlympiaAccountRef): Promise<OlympiaFunds> {
  const { moves, more } = await readMovements(ref);
  const items = movementsToFlowItems(ref.address, OLYMPIA_XRD_RRI, moves);
  return { ...summarizeFunds(ref.address, items, OLYMPIA_XRD_RRI), more };
}
