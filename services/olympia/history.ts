/**
 * services/olympia/history.ts
 *
 * What an Olympia account held at any point of Olympia, not only at its end:
 * the official Olympia Gateway's `at_state_identifier`, answered from the
 * archive. Checked against that Gateway on random accounts and versions: the
 * same balances, and the same stakes to the last 10^-18.
 *
 * - Balances come from the account's balance changes (`balance_after` of the
 *   last change of each token at or before the version). An account with a
 *   long history reads whichever side of the version is shorter: before it,
 *   or after it, undoing each later change from the final balances.
 * - Stakes come from the account's stake history and the validator's, both
 *   rows in effect at the version: stake units valued at the validator's XRD
 *   per unit then, as the Gateway does.
 * - A day is its last state version (UTC), from a small precomputed table.
 */
import 'server-only';
import { OLYMPIA_FINAL_STATE_VERSION, OLYMPIA_XRD_RRI } from '@/features/dashboard/lib/olympia';
import type { OlympiaAccountStateAt, OlympiaStake } from '@/types/olympia';
import type { OlympiaAccountRef } from './accounts';
import { tokenCatalog, validatorCatalog } from './catalog';
import dayEnds from './data/day-end-versions.json';
import { OLYMPIA_FILES as F } from './files';
import { mapTokenAmount } from './mappers';
import { attoToNumber, countEqWithin, readEq, readEqCovering, readEqWithin, toNum, type Row } from './parquet';

const LAST = BigInt(OLYMPIA_FINAL_STATE_VERSION);
const DAY_ENDS = dayEnds as Record<string, number>;

/** The last state version of a UTC day of Olympia, or null outside it. */
export function versionAtDayEnd(day: string): number | null {
  return DAY_ENDS[day] ?? null;
}

/** The first and last day of Olympia, for date pickers and validation. */
export function olympiaDayRange(): { first: string; last: string } {
  const days = Object.keys(DAY_ENDS).sort();
  return { first: days[0], last: days[days.length - 1] };
}

const big = (v: unknown): bigint => {
  const s = typeof v === 'bigint' ? v.toString() : String(v ?? '0');
  return /^-?\d+$/.test(s) ? BigInt(s) : 0n;
};

/** Balance of each token (in 10^-18 units) the account held at `at`. */
async function balancesAt(ref: OlympiaAccountRef, at: bigint): Promise<Map<string, bigint>> {
  const path = F.accountBalanceChanges.path;
  const [before, after] = await Promise.all([
    countEqWithin(path, 'account_id', ref.id, 'state_version', 0n, at),
    countEqWithin(path, 'account_id', ref.id, 'state_version', at + 1n, LAST),
  ]);
  const out = new Map<string, bigint>();
  if (before <= after) {
    // Last change of each token at or before `at`; (account, version, token) is unique.
    const last = new Map<string, Row>();
    for (const r of await readEqWithin(path, 'account_id', ref.id, 'state_version', 0n, at)) {
      const rri = String(r.rri);
      const seen = last.get(rri);
      if (!seen || toNum(r.state_version) > toNum(seen.state_version)) last.set(rri, r);
    }
    for (const [rri, r] of last) out.set(rri, big(r.balance_after));
  } else {
    // The final balance, unless the token changed later: then what it was just before its first later change.
    const [finals, later] = await Promise.all([
      readEq(F.accountFinalBalances.path, F.accountFinalBalances.key, ref.id, ['account_id', 'rri', 'balance']),
      readEqWithin(path, 'account_id', ref.id, 'state_version', at + 1n, LAST),
    ]);
    for (const r of finals) out.set(String(r.rri), big(r.balance));
    const first = new Map<string, Row>();
    for (const r of later) {
      const rri = String(r.rri);
      const seen = first.get(rri);
      if (!seen || toNum(r.state_version) < toNum(seen.state_version)) first.set(rri, r);
    }
    for (const [rri, r] of first) out.set(rri, big(r.balance_after) - big(r.delta));
  }
  for (const [rri, v] of out) if (v <= 0n) out.delete(rri);
  return out;
}

/** The account's stakes at `at`, valued as the official Olympia Gateway values them. */
async function stakesAt(ref: OlympiaAccountRef, at: bigint): Promise<OlympiaStake[]> {
  const rows = await readEqCovering(F.accountStakeHistory.path, 'account_id', ref.id, 'from_state_version', 'to_state_version', at);
  const live = rows.filter((r) => big(r.total_stake_units) > 0n || big(r.total_prepared_xrd_stake) > 0n
    || big(r.total_prepared_unstake_units) > 0n || big(r.total_exiting_xrd_stake) > 0n);
  if (live.length === 0) return [];
  const [pools, validators] = await Promise.all([
    Promise.all(live.map((r) => readEqCovering(F.validatorStakeHistory.path, 'validator_id', big(r.validator_id), 'from_state_version', 'to_state_version', at))),
    validatorCatalog(),
  ]);
  return live.map((r, i) => {
    const pool = pools[i][0];
    const xrd = big(pool?.total_xrd_staked);
    const units = big(pool?.total_stake_units) + big(pool?.total_prepared_unstake_units);
    // Units being unstaked are still backed by the pool until they exit.
    const value = (u: bigint) => (units > 0n ? (u * xrd) / units : u);
    const validatorAddress = String(r.validator_address);
    return {
      validatorAddress,
      validatorName: validators.get(validatorAddress)?.name ?? null,
      stakedXrd: attoToNumber(value(big(r.total_stake_units))),
      pendingStakeXrd: attoToNumber(r.total_prepared_xrd_stake),
      pendingUnstakeXrd: attoToNumber(value(big(r.total_prepared_unstake_units))),
      exitingXrd: attoToNumber(r.total_exiting_xrd_stake),
    };
  }).sort((a, b) => b.stakedXrd - a.stakedXrd);
}

/** Balances and stakes of an Olympia account at a state version. */
export async function getAccountStateAt(ref: OlympiaAccountRef, stateVersion: number, day: string | null = null): Promise<OlympiaAccountStateAt> {
  const at = BigInt(stateVersion);
  const [balances, stakes, tokens] = await Promise.all([balancesAt(ref, at), stakesAt(ref, at), tokenCatalog()]);
  const amounts = [...balances].map(([rri, v]) => mapTokenAmount(rri, v, tokens));
  const xrd = amounts.find((a) => a.rri === OLYMPIA_XRD_RRI) ?? null;
  const sum = (f: (s: OlympiaStake) => number) => stakes.reduce((acc, s) => acc + f(s), 0);
  const liquidXrd = xrd?.amountNum ?? 0;
  const stakedXrd = sum((s) => s.stakedXrd);
  const pendingStakeXrd = sum((s) => s.pendingStakeXrd);
  const unstakingXrd = sum((s) => s.pendingUnstakeXrd + s.exitingXrd);
  return {
    address: ref.address,
    babylonAddress: ref.babylonAddress,
    stateVersion,
    day,
    xrd,
    tokens: amounts.filter((a) => a.rri !== OLYMPIA_XRD_RRI).sort((a, b) => b.amountNum - a.amountNum),
    stakes,
    totals: { liquidXrd, stakedXrd, pendingStakeXrd, unstakingXrd, totalXrd: liquidXrd + stakedXrd + pendingStakeXrd + unstakingXrd },
  };
}
