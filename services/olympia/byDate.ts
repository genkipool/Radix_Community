/**
 * services/olympia/byDate.ts
 *
 * Every Olympia transaction in a time window, newest first, paginated by state
 * version: what the explorer's calendar shows for a day before Babylon. The
 * transactions file is sorted by state version and its timestamps grow with
 * it, so a day reads one or two row groups, and the actions, balance changes
 * and raw payloads of a page come from one range read each.
 */
import 'server-only';
import type { OlympiaTxDetail } from '@/types/olympia';
import { tokenCatalog, validatorCatalog } from './catalog';
import { OLYMPIA_FILES as F } from './files';
import { mapAction, mapBalanceChange, messageOf, toIso, toNum } from './mappers';
import { attoToNumber, readPageDescWithin, readRange, type Row } from './parquet';

export interface OlympiaTxDatePage {
  items: OlympiaTxDetail[];
  /** State version to pass as `before` for the next page; absent at the end. */
  nextCursor?: string;
}

function byVersion(rows: Row[]): Map<number, Row[]> {
  const map = new Map<number, Row[]>();
  for (const r of rows) {
    const k = toNum(r.state_version);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

/** Transactions whose round timestamp lies in [fromMs, toMs], newest first. */
export async function getTransactionsByDate(fromMs: number, toMs: number, before: bigint | null, limit = 15): Promise<OlympiaTxDatePage> {
  const { rows, more } = await readPageDescWithin(
    F.txByVersion.path, 'round_timestamp', BigInt(fromMs), BigInt(toMs), F.txByVersion.key, before, limit,
  );
  if (rows.length === 0) return { items: [] };

  const lo = BigInt(toNum(rows[rows.length - 1].state_version));
  const hi = BigInt(toNum(rows[0].state_version));
  const [ops, changes, raws, tokens, validators] = await Promise.all([
    readRange(F.operationsByVersion.path, F.operationsByVersion.key, lo, hi),
    readRange(F.balanceChangesByVersion.path, F.balanceChangesByVersion.key, lo, hi),
    readRange(F.rawTxByVersion.path, F.rawTxByVersion.key, lo, hi),
    tokenCatalog(),
    validatorCatalog(),
  ]);
  const opsBy = byVersion(ops);
  const changesBy = byVersion(changes);
  const rawBy = byVersion(raws);

  const items: OlympiaTxDetail[] = rows.map((r) => {
    const sv = toNum(r.state_version);
    const allChanges = (changesBy.get(sv) ?? []).map((c) => mapBalanceChange(c, tokens));
    const payload = rawBy.get(sv)?.[0]?.payload;
    return {
      transactionId: String(r.transaction_id),
      stateVersion: sv,
      timestamp: toIso(r.round_timestamp),
      feeXrd: attoToNumber(r.fee_paid),
      ...messageOf(r.message),
      epoch: toNum(r.epoch),
      round: toNum(r.round_in_epoch),
      feePayer: typeof r.fee_payer_address === 'string' ? r.fee_payer_address : null,
      accountsCount: toNum(r.accounts_count),
      actions: (opsBy.get(sv) ?? [])
        .sort((a, b) => toNum(a.operation_group_index) - toNum(b.operation_group_index))
        .map((o) => mapAction(o, tokens, validators)),
      balanceChanges: allChanges,
      allBalanceChanges: allChanges,
      rawHex: typeof payload === 'string' ? payload : null,
    };
  });
  return { items, nextCursor: more ? String(items[items.length - 1].stateVersion) : undefined };
}
