/**
 * services/olympia/transactions.ts
 *
 * Olympia transactions: one account's history (newest first, paginated by
 * state version) and a single transaction in full.
 */
import 'server-only';
import { OLYMPIA_FINAL_STATE_VERSION, OLYMPIA_XRD_RRI } from '@/features/dashboard/lib/olympia';
import type { OlympiaAccountMove, OlympiaTxDetail, OlympiaTxItem, OlympiaTxPage } from '@/types/olympia';
import dayEnds from './data/day-end-versions.json';
import { tokenCatalog, validatorCatalog } from './catalog';
import { OLYMPIA_FILES as F } from './files';
import { mapAccountAction, mapAction, mapBalanceChange, messageOf, toIso, toNum } from './mappers';
import { attoToNumber, countEqWithin, readEq, readEqWithin, readPageDesc, type Row } from './parquet';

export interface AccountRef {
  id: bigint;
  address: string;
}

function groupBy(rows: Row[], key: string): Map<number, Row[]> {
  const map = new Map<number, Row[]>();
  for (const r of rows) {
    const k = toNum(r[key]);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

/** A page of an account's transactions, newest first, each with that account's actions and balance changes. */
export async function getAccountTxPage(account: AccountRef, before: bigint | null, limit = 15): Promise<OlympiaTxPage> {
  const { rows, more } = await readPageDesc(F.accountTxs.path, F.accountTxs.key, account.id, F.accountTxs.order, before, limit);
  if (rows.length === 0) return { items: [] };

  const lo = BigInt(toNum(rows[rows.length - 1].state_version));
  const hi = BigInt(toNum(rows[0].state_version));
  const [ops, changes, tokens, validators] = await Promise.all([
    readEqWithin(F.accountOperations.path, 'account_id', account.id, 'state_version', lo, hi),
    readEqWithin(F.accountBalanceChanges.path, 'account_id', account.id, 'state_version', lo, hi),
    tokenCatalog(),
    validatorCatalog(),
  ]);
  const opsBy = groupBy(ops, 'state_version');
  const changesBy = groupBy(changes, 'state_version');

  const items: OlympiaTxItem[] = rows.map((r) => {
    const sv = toNum(r.state_version);
    return {
      transactionId: String(r.transaction_id),
      stateVersion: sv,
      timestamp: toIso(r.round_timestamp),
      feeXrd: attoToNumber(r.fee_paid),
      isFeePayer: r.is_fee_payer === true,
      ...messageOf(r.message),
      actions: (opsBy.get(sv) ?? []).map((o) => mapAccountAction(o, account.address, tokens, validators)),
      balanceChanges: (changesBy.get(sv) ?? []).map((c) => mapBalanceChange(c, tokens)),
    };
  });
  return { items, nextCursor: more ? String(items[items.length - 1].stateVersion) : undefined };
}

/** The last state version of Olympia's genesis: balances there were given, not sent. */
const GENESIS_LAST_VERSION = 647;
/** Most balance changes a year's CSV reads: beyond it the answer would not fit one response. */
export const MAX_ACCOUNT_MOVES = 10_000;

const DAY_ENDS = Object.entries(dayEnds as Record<string, number>).sort((a, b) => a[1] - b[1]);

/** The UTC day a state version belongs to. */
function dayOfVersion(v: number): string {
  let lo = 0;
  let hi = DAY_ENDS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (DAY_ENDS[mid][1] >= v) hi = mid;
    else lo = mid + 1;
  }
  return DAY_ENDS[lo][0];
}

function yearVersions(year: number): { lo: bigint; hi: bigint } {
  const ends = dayEnds as Record<string, number>;
  return {
    lo: BigInt((ends[`${year - 1}-12-31`] ?? 0) + 1),
    hi: BigInt(ends[`${year}-12-31`] ?? OLYMPIA_FINAL_STATE_VERSION),
  };
}

/**
 * Every change of an account's liquid balance in a year, oldest first, with
 * what the CSV needs of its transaction: fee, stakes, unstake requests and
 * the net change per token. `tooMany` when the year has more than
 * MAX_ACCOUNT_MOVES balance changes (nothing is read then).
 */
export async function getAccountMovesInYear(account: AccountRef, year: number): Promise<{ moves: OlympiaAccountMove[]; tooMany: boolean }> {
  const { lo, hi } = yearVersions(year);
  const path = F.accountBalanceChanges.path;
  if (await countEqWithin(path, 'account_id', account.id, 'state_version', lo, hi) > MAX_ACCOUNT_MOVES) return { moves: [], tooMany: true };
  const [changes, txs, ops, tokens, validators] = await Promise.all([
    readEqWithin(path, 'account_id', account.id, 'state_version', lo, hi),
    readEqWithin(F.accountTxs.path, F.accountTxs.key, account.id, 'state_version', lo, hi),
    readEqWithin(F.accountOperations.path, 'account_id', account.id, 'state_version', lo, hi),
    tokenCatalog(),
    validatorCatalog(),
  ]);
  const changesBy = groupBy(changes, 'state_version');
  const txBy = new Map(txs.map((t) => [toNum(t.state_version), t]));
  const opsBy = groupBy(ops, 'state_version');
  const versions = [...new Set([...changesBy.keys(), ...txBy.keys()])].sort((a, b) => a - b);

  const moves = versions.map((v): OlympiaAccountMove => {
    const tx = txBy.get(v);
    const feeXrd = tx && tx.is_fee_payer === true ? attoToNumber(tx.fee_paid) : 0;
    const name = (o: Row) => {
      const addr = String(o.validator_address ?? '');
      return validators.get(addr)?.name ?? addr.slice(0, 25);
    };
    const vOps = opsBy.get(v) ?? [];
    return {
      stateVersion: v,
      timestamp: (tx ? toIso(tx.round_timestamp) : null) ?? `${dayOfVersion(v)}T23:59:59.000Z`,
      transactionId: tx ? String(tx.transaction_id) : null,
      feeXrd,
      stakes: vOps.filter((o) => o.action_type === 'STAKE_TOKENS').map((o) => ({ validatorName: name(o), xrd: attoToNumber(o.amount) })),
      unstakes: vOps.filter((o) => o.action_type === 'UNSTAKE_TOKENS').map((o) => ({ validatorName: name(o), xrd: attoToNumber(o.amount) })),
      changes: (changesBy.get(v) ?? []).map((c) => {
        const rri = String(c.rri);
        // The fee is its own column: the XRD change without it.
        const delta = attoToNumber(c.delta) + (rri === OLYMPIA_XRD_RRI ? feeXrd : 0);
        return { rri, symbol: tokens.get(rri)?.symbol ?? rri, delta };
      }).filter((c) => Math.abs(c.delta) > 1e-12),
      ...(v <= GENESIS_LAST_VERSION ? { genesis: true } : {}),
    };
  });
  return { moves, tooMany: false };
}

/** A transaction by its 64-hex id, or null when Olympia has no such user transaction. */
export async function getTransactionById(txId: string): Promise<OlympiaTxDetail | null> {
  const hit = await readEq(F.txById.path, F.txById.key, txId.toLowerCase(), ['transaction_id', 'state_version']);
  if (hit.length === 0) return null;
  return getTransactionByVersion(BigInt(toNum(hit[0].state_version)));
}

export async function getTransactionByVersion(stateVersion: bigint): Promise<OlympiaTxDetail | null> {
  const [tx, ops, changes, raw, tokens, validators] = await Promise.all([
    readEq(F.txByVersion.path, F.txByVersion.key, stateVersion),
    readEq(F.operationsByVersion.path, F.operationsByVersion.key, stateVersion),
    readEq(F.balanceChangesByVersion.path, F.balanceChangesByVersion.key, stateVersion),
    readEq(F.rawTxByVersion.path, F.rawTxByVersion.key, stateVersion),
    tokenCatalog(),
    validatorCatalog(),
  ]);
  const r = tx[0];
  if (!r) return null;
  const allChanges = changes.map((c) => mapBalanceChange(c, tokens));
  return {
    transactionId: String(r.transaction_id),
    stateVersion: toNum(r.state_version),
    timestamp: toIso(r.round_timestamp),
    feeXrd: attoToNumber(r.fee_paid),
    ...messageOf(r.message),
    epoch: toNum(r.epoch),
    round: toNum(r.round_in_epoch),
    feePayer: typeof r.fee_payer_address === 'string' ? r.fee_payer_address : null,
    accountsCount: toNum(r.accounts_count),
    actions: ops.sort((a, b) => toNum(a.operation_group_index) - toNum(b.operation_group_index)).map((o) => mapAction(o, tokens, validators)),
    balanceChanges: allChanges,
    allBalanceChanges: allChanges,
    rawHex: typeof raw[0]?.payload === 'string' ? raw[0].payload : null,
  };
}
