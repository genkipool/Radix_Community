/**
 * services/olympia/mappers.ts
 *
 * Turns Parquet rows into the shapes in `types/olympia.ts`. Kept apart from the
 * readers so every module labels tokens, validators and amounts the same way.
 */
import 'server-only';
import { decodeOlympiaMessage } from '@/features/dashboard/lib/olympia';
import type { OlympiaAction, OlympiaBalanceChange, OlympiaTokenAmount } from '@/types/olympia';
import type { TokenInfo, ValidatorInfo } from './catalog';
import { attoToDecimal, attoToNumber, toIso, toNum, type Row } from './parquet';

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function mapAction(r: Row, tokens: Map<string, TokenInfo>, validators: Map<string, ValidatorInfo>): OlympiaAction {
  const rri = str(r.rri);
  const validator = str(r.validator_address);
  const raw = r.amount ?? null;
  return {
    index: toNum(r.operation_group_index),
    type: str(r.action_type),
    from: str(r.from_address) ?? (r.direction === 'in' ? str(r.counterparty_address) : null),
    to: str(r.to_address) ?? (r.direction === 'out' ? str(r.counterparty_address) : null),
    validator,
    validatorName: validator ? validators.get(validator)?.name ?? null : null,
    amount: raw === null ? null : attoToDecimal(raw),
    amountNum: raw === null ? 0 : attoToNumber(raw),
    rri,
    symbol: rri ? tokens.get(rri)?.symbol ?? '' : '',
  };
}

/**
 * Actions as seen from one account: the account itself is the `from` of what it
 * sent and the `to` of what it received (operations_by_account stores only the
 * counterparty).
 */
export function mapAccountAction(
  r: Row,
  account: string,
  tokens: Map<string, TokenInfo>,
  validators: Map<string, ValidatorInfo>,
): OlympiaAction {
  const a = mapAction(r, tokens, validators);
  if (r.direction === 'out') a.from = account;
  if (r.direction === 'in') a.to = account;
  return a;
}

export function mapBalanceChange(r: Row, tokens: Map<string, TokenInfo>): OlympiaBalanceChange {
  const rri = String(r.rri);
  const t = tokens.get(rri);
  return {
    address: str(r.address) ?? undefined,
    rri,
    symbol: t?.symbol ?? '',
    name: t?.name ?? null,
    iconUrl: t?.iconUrl ?? null,
    delta: attoToDecimal(r.delta),
    deltaNum: attoToNumber(r.delta),
  };
}

export function mapTokenAmount(rri: string, amount: unknown, tokens: Map<string, TokenInfo>): OlympiaTokenAmount {
  const t = tokens.get(rri);
  return {
    rri,
    symbol: t?.symbol ?? rri,
    name: t?.name ?? null,
    iconUrl: t?.iconUrl ?? null,
    amount: attoToDecimal(amount),
    amountNum: attoToNumber(amount),
  };
}

/** The readable message of a transaction and whether it was sent encrypted. */
export function messageOf(storedHex: unknown): { message: string | null; messageEncrypted: boolean } {
  const m = decodeOlympiaMessage(typeof storedHex === 'string' ? storedHex : null);
  return { message: m?.kind === 'text' ? m.text : null, messageEncrypted: m?.kind === 'encrypted' };
}

export { toIso, toNum };
