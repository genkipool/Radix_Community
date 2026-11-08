/**
 * services/olympia/transactions.ts
 *
 * Olympia transactions: one account's history (newest first, paginated by
 * state version) and a single transaction in full.
 */
import 'server-only';
import type { OlympiaTxDetail, OlympiaTxItem, OlympiaTxPage } from '@/types/olympia';
import { tokenCatalog, validatorCatalog } from './catalog';
import { OLYMPIA_FILES as F } from './files';
import { mapAccountAction, mapAction, mapBalanceChange, messageOf, toIso, toNum } from './mappers';
import { attoToNumber, readEq, readEqWithin, readPageDesc, type Row } from './parquet';

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
