/*
 * Olympia staking rewards as CSV, in the same formats as Babylon's exports:
 * accounts in the CoinTracking layout of the account rewards CSV
 * (services/clientCsvExport.ts), validators in the layout of the validator
 * rewards CSV (services/validatorRewards.ts, generateRewardsCsv). Pure.
 */
import type { OlympiaAccountMove, OlympiaDailyReward, OlympiaValidatorDay } from '@/types/olympia';
import { csvRow, rowsToCsv } from '../utils/coinTrackingCsv';

/**
 * What an account's CSV lists: everything (its rewards, its validator fee and
 * its movements), only what it earned delegating, or only its validator fee.
 */
export type OlympiaRewardKind = 'all' | 'delegator' | 'validator';

/**
 * The rows of an account's movements in the layout of the Babylon account CSV
 * (services/clientCsvExport.ts): a stake leaves the wallet (Withdrawal), stake
 * returned after an unstake comes back (Deposit), transfers in and out are
 * Deposits and Withdrawals, both at once a Trade, and the network fee goes in
 * the fee column of the first row or a row of its own.
 */
export function olympiaMovesCsvRows(moves: OlympiaAccountMove[]): string[][] {
  const rows: string[][] = [];
  for (const m of moves) {
    const date = m.timestamp.replace('T', ' ').slice(0, 19);
    const hash = m.transactionId ?? '';
    if (!m.transactionId) {
      for (const c of m.changes) {
        if (c.delta > 0) {
          rows.push(m.genesis
            ? csvRow('Deposit', c.delta, c.symbol, 0, '', 0, '', 'Transfer', 'Olympia genesis balance', date)
            : csvRow('Deposit', c.delta, c.symbol, 0, '', 0, '', 'Staking', 'Olympia unstaked XRD returned', date));
        } else {
          rows.push(csvRow('Withdrawal', 0, '', -c.delta, c.symbol, 0, '', 'Transfer', 'Olympia ledger change', date));
        }
      }
      continue;
    }
    let fee = m.feeXrd;
    const takeFee = () => { const f = fee; fee = 0; return f; };
    for (const s of m.stakes) {
      const f = takeFee();
      rows.push(csvRow('Withdrawal', 0, '', s.xrd, 'XRD', f, f > 0 ? 'XRD' : '', 'Staking', `Olympia stake → ${s.validatorName.slice(0, 30)}`, date, hash));
    }
    if (m.unstakes.length > 0 && fee > 0) {
      rows.push(csvRow('Other Fee', 0, '', 0, '', takeFee(), 'XRD', 'Staking', `Olympia unstake request — ${m.unstakes[0].validatorName.slice(0, 30)}`, date, hash));
    }
    // What the stakes did not explain: transfers, mints, trades.
    const stakedXrd = m.stakes.reduce((acc, s) => acc + s.xrd, 0);
    const rest = m.changes
      .map((c) => (c.symbol === 'XRD' && stakedXrd > 0 ? { ...c, delta: c.delta + stakedXrd } : c))
      .filter((c) => Math.abs(c.delta) > 1e-9);
    const ins = rest.filter((c) => c.delta > 0);
    const outs = rest.filter((c) => c.delta < 0);
    if (ins.length > 0 && outs.length > 0) {
      for (let i = 0; i < Math.max(ins.length, outs.length); i++) {
        const f = takeFee();
        rows.push(csvRow('Trade', ins[i]?.delta ?? 0, ins[i]?.symbol ?? '', -(outs[i]?.delta ?? 0), outs[i]?.symbol ?? '', f, f > 0 ? 'XRD' : '', 'Trade', 'Olympia token swap', date, hash));
      }
    } else {
      for (const c of ins) {
        const f = takeFee();
        rows.push(csvRow('Deposit', c.delta, c.symbol, 0, '', f, f > 0 ? 'XRD' : '', 'Transfer', `Olympia received ${c.symbol}`, date, hash));
      }
      for (const c of outs) {
        const f = takeFee();
        rows.push(csvRow('Withdrawal', 0, '', -c.delta, c.symbol, f, f > 0 ? 'XRD' : '', 'Transfer', `Olympia sent ${c.symbol}`, date, hash));
      }
    }
    if (fee > 0) rows.push(csvRow('Other Fee', 0, '', 0, '', takeFee(), 'XRD', 'Network', 'Olympia transaction fee', date, hash));
  }
  return rows;
}

/**
 * One row per day and validator for the delegator reward, and one for the
 * validator fee when the account owned it; `all` adds the account's movements
 * of that year (`moves`). The total counts only the rewards.
 */
export function olympiaAccountRewardsCsv(days: OlympiaDailyReward[], kind: OlympiaRewardKind = 'all', moves: OlympiaAccountMove[] = []): { csv: string; totalXrd: number } {
  const rows: string[][] = [];
  let totalXrd = 0;
  for (const d of days) {
    const name = (d.validatorName || d.validatorAddress.slice(0, 25)).slice(0, 35);
    const date = `${d.day} 00:00:00`;
    if (kind !== 'validator' && d.delegatorXrd > 0) {
      rows.push(csvRow('Staking', d.delegatorXrd, 'XRD', 0, '', 0, '', 'Staking', `Olympia staking reward — ${name}`, date));
      totalXrd += d.delegatorXrd;
    }
    if (kind !== 'delegator' && d.feeXrd > 0) {
      rows.push(csvRow('Staking', d.feeXrd, 'XRD', 0, '', 0, '', 'Staking', `Olympia validator fee — ${name}`, date));
      totalXrd += d.feeXrd;
    }
  }
  if (kind === 'all') rows.push(...olympiaMovesCsvRows(moves));
  rows.sort((a, b) => a[10].localeCompare(b[10]));
  return { csv: rows.length ? rowsToCsv(rows) : '', totalXrd };
}

const VALIDATOR_HEADER = ['Type', 'Buy', 'Cur.', 'Sell', 'Cur.', 'Fee', 'Cur.', 'Exchange', 'Group', 'Comment', 'Date'];

/** The validator owner's daily fee, as the Babylon validator CSV lists it. */
export function olympiaValidatorRewardsCsv(address: string, days: OlympiaValidatorDay[]): { csv: string; totalXrd: number } {
  const short = `${address.substring(0, 20)}...`;
  const rows = days
    .filter((d) => d.feeXrd > 0)
    .map((d) => ['Staking', d.feeXrd.toFixed(8), 'XRD', '', '', '', '', 'Radix Network', 'Staking', `Olympia daily reward - ${short}`, `${d.day} 00:00:00`]);
  const totalXrd = days.reduce((acc, d) => acc + d.feeXrd, 0);
  return { csv: rows.length ? rowsToCsv(rows, VALIDATOR_HEADER) : '', totalXrd };
}

/** Saves text as a file in the browser. */
export function downloadText(filename: string, text: string, type = 'text/csv; charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
