/*
 * Olympia staking rewards as CSV, in the same formats as Babylon's exports:
 * accounts in the CoinTracking layout of the account rewards CSV
 * (services/clientCsvExport.ts), validators in the layout of the validator
 * rewards CSV (services/validatorRewards.ts, generateRewardsCsv). Pure.
 */
import type { OlympiaDailyReward, OlympiaValidatorDay } from '@/types/olympia';
import { csvRow, rowsToCsv } from '../utils/coinTrackingCsv';

/** Which rewards of an account a CSV lists: all, only what it earned delegating, or only its validator fee. */
export type OlympiaRewardKind = 'all' | 'delegator' | 'validator';

/** One row per day and validator for the delegator reward, and one for the validator fee when the account owned it. */
export function olympiaAccountRewardsCsv(days: OlympiaDailyReward[], kind: OlympiaRewardKind = 'all'): { csv: string; totalXrd: number } {
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
