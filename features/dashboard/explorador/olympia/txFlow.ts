/*
 * What an Olympia transaction moved, arranged the way the Babylon transaction
 * card draws it: who sent (origin), who received (destination), the fee kept
 * apart from the sender's balance change, and the one amount the card header
 * shows. Pure: works on the `/api/olympia/tx` answer.
 */
import type { OlympiaTxDetail } from '@/types/olympia';
import { OLYMPIA_XRD_RRI } from '@/features/dashboard/lib/olympia';

export interface OlympiaFlowRow {
  /** Account (rdx1…) or validator (rv1…). */
  address: string;
  /** Validator name, for stake / unstake rows. */
  label?: string | null;
  rri: string;
  symbol: string;
  name?: string | null;
  iconUrl?: string | null;
  /** Signed: negative leaves the address, positive reaches it. */
  amount: number;
  /** Plain transfer, XRD put into or taken out of a validator's stake. */
  kind: 'transfer' | 'stake' | 'unstake';
}

export interface OlympiaTxFlow {
  origin: OlympiaFlowRow[];
  destination: OlympiaFlowRow[];
  /** The fee payer when it had no other change: it shows in the origin with its fee only. */
  feeOnlyPayer: string | null;
  fee: number;
  feePayer: string | null;
  /** Readable action types, without the fee burn every transaction carries. */
  types: string[];
  headline: { kind: 'stake' | 'unstake' | 'amount' | 'fee'; amount: number; symbol: string };
  /** Every address the transaction touched (accounts, validators and tokens), in first-seen order. */
  entities: { address: string; label?: string | null }[];
  /** Tokens the transaction created. */
  created: { address: string; label?: string | null }[];
}

const EPS = 1e-12;

export function olympiaTxFlow(tx: OlympiaTxDetail): OlympiaTxFlow {
  const fee = tx.feeXrd;
  const feePayer = tx.feePayer;
  const rows: OlympiaFlowRow[] = [];
  let payerHasChange = false;

  for (const c of tx.allBalanceChanges) {
    if (!c.address) continue;
    // The payer's XRD change includes the burnt fee; the card lists the fee on its own.
    const isPayerXrd = c.address === feePayer && c.rri === OLYMPIA_XRD_RRI;
    const amount = isPayerXrd ? c.deltaNum + fee : c.deltaNum;
    if (Math.abs(amount) < EPS) continue;
    if (c.address === feePayer) payerHasChange = true;
    rows.push({ address: c.address, rri: c.rri, symbol: c.symbol, name: c.name, iconUrl: c.iconUrl, amount, kind: 'transfer' });
  }

  // A stake or an unstake moves no liquid balance into a validator: the
  // validator side only shows in the actions.
  for (const a of tx.actions) {
    if (!a.validator || !a.amountNum) continue;
    const rri = a.rri ?? OLYMPIA_XRD_RRI;
    const symbol = a.symbol || 'XRD';
    if (a.type === 'STAKE_TOKENS') {
      rows.push({ address: a.validator, label: a.validatorName, rri, symbol, amount: a.amountNum, kind: 'stake' });
    } else if (a.type === 'UNSTAKE_TOKENS') {
      rows.push({ address: a.validator, label: a.validatorName, rri, symbol, amount: -a.amountNum, kind: 'unstake' });
      if (a.from) {
        rows.push({ address: a.from, rri, symbol, amount: a.amountNum, kind: 'unstake' });
        if (a.from === feePayer) payerHasChange = true;
      }
    }
  }

  const types = [...new Set(tx.actions.map((a) => a.type).filter((t): t is string => !!t && t !== 'BURN_XRD'))];
  const sum = (type: string) => tx.actions.filter((a) => a.type === type).reduce((s, a) => s + a.amountNum, 0);
  const staked = sum('STAKE_TOKENS');
  const unstaked = sum('UNSTAKE_TOKENS');
  const transfers = tx.actions.filter((a) => a.type === 'TRANSFER_TOKENS' || a.type === 'MINT_TOKENS' || a.type === 'BURN_TOKENS');
  const firstTransfer = transfers.find((a) => a.rri === OLYMPIA_XRD_RRI) ?? transfers[0];
  const headline: OlympiaTxFlow['headline'] = staked > 0
    ? { kind: 'stake', amount: staked, symbol: 'XRD' }
    : unstaked > 0
      ? { kind: 'unstake', amount: unstaked, symbol: 'XRD' }
      : firstTransfer
        ? {
          kind: 'amount',
          amount: transfers.filter((a) => a.rri === firstTransfer.rri).reduce((s, a) => s + a.amountNum, 0),
          symbol: firstTransfer.symbol || 'XRD',
        }
        : { kind: 'fee', amount: fee, symbol: 'XRD' };

  const seen = new Map<string, string | null | undefined>();
  const see = (address: string | null | undefined, label?: string | null) => {
    if (address && !seen.has(address)) seen.set(address, label);
  };
  see(feePayer);
  for (const a of tx.actions) { see(a.from); see(a.to); see(a.validator, a.validatorName); }
  for (const r of rows) see(r.address, r.label);
  for (const a of tx.actions) see(a.rri, a.symbol);
  for (const c of tx.allBalanceChanges) see(c.rri, c.symbol);
  const created = tx.actions
    .filter((a) => a.type === 'CREATE_TOKEN_DEFINITION' && a.rri)
    .map((a) => ({ address: a.rri as string, label: a.symbol }));

  return {
    origin: rows.filter((r) => r.amount < 0),
    destination: rows.filter((r) => r.amount > 0),
    feeOnlyPayer: feePayer && fee > 0 && !payerHasChange ? feePayer : null,
    fee,
    feePayer,
    types,
    headline,
    entities: [...seen].map(([address, label]) => ({ address, label })),
    created,
  };
}
