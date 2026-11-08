/**
 * services/olympia/rewards.ts
 *
 * Olympia staking rewards, per UTC day.
 *
 * How they were earned (olympia-node, EpochConstructionState.calculateEmission):
 * at each epoch change a validator's emission, minus its fee, was added to its
 * stake pool, raising the XRD value of every stake unit (the delegators'
 * reward); the fee was staked for the validator's owner. The dataset computes
 * both per account, validator and day (see the dataset README).
 *
 * Everything is read from the dataset's Parquet files, never from Redis: the
 * data is final, a validator's whole history is one small row group (about 800
 * rows) and an account's rewards are its own rows, so a read costs no Redis
 * command and downloads only what it shows.
 */
import 'server-only';
import type { ValidatorRewardData } from '@/services/validatorRewards';
import type { OlympiaDailyReward, OlympiaValidatorDay } from '@/types/olympia';
import { validatorCatalog } from './catalog';
import { OLYMPIA_FILES as F } from './files';
import { toIso, toNum } from './mappers';
import { readEq, type Row } from './parquet';

export const OLYMPIA_REWARD_YEARS = [2021, 2022, 2023] as const;

const dayOf = (v: unknown): string => (toIso(v) ?? '').slice(0, 10);

function yearWindow(year: number): [Date, Date] {
  return [new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31))];
}

/** An account's staking rewards in one year, per day and validator. */
export async function getAccountRewards(accountId: bigint, year: number): Promise<OlympiaDailyReward[]> {
  const [from, to] = yearWindow(year);
  const [rows, validators] = await Promise.all([
    readEq(F.accountRewardsDaily.path, F.accountRewardsDaily.key, accountId),
    validatorCatalog(),
  ]);
  return rows
    .filter((r) => {
      const d = r.day instanceof Date ? r.day : new Date(String(r.day));
      return d >= from && d <= to;
    })
    .map((r) => {
      const validatorAddress = String(r.validator_address);
      return {
        day: dayOf(r.day),
        validatorAddress,
        validatorName: validators.get(validatorAddress)?.name ?? null,
        delegatorXrd: toNum(r.delegator_reward_xrd),
        feeXrd: toNum(r.fee_reward_xrd),
      };
    })
    .sort((a, b) => a.day.localeCompare(b.day) || a.validatorAddress.localeCompare(b.validatorAddress));
}

/** Per-validator daily data, in the shape Babylon's rewards use, built from Parquet rows. */
export function toValidatorRewardData(rows: Row[]): ValidatorRewardData {
  const data: ValidatorRewardData = { lastSyncedEpoch: 0, daily: {}, yearly: {}, dailyDelegants: {}, yearlyDelegants: {}, dailyStake: {} };
  for (const r of rows) {
    const day = dayOf(r.day);
    const year = day.slice(0, 4);
    const fee = toNum(r.fee_reward_xrd);
    const deleg = toNum(r.delegators_reward_xrd);
    data.daily[day] = (data.daily[day] ?? 0) + fee;
    data.yearly[year] = (data.yearly[year] ?? 0) + fee;
    data.dailyDelegants![day] = (data.dailyDelegants![day] ?? 0) + deleg;
    data.yearlyDelegants![year] = (data.yearlyDelegants![year] ?? 0) + deleg;
    data.dailyStake![day] = toNum(r.total_stake_xrd);
  }
  return data;
}

async function fromDataset(address: string, year: number): Promise<ValidatorRewardData> {
  // About 800 rows per validator for the whole of Olympia: one row group.
  const rows = await readEq(F.validatorRewardsDaily.path, F.validatorRewardsDaily.key, address);
  return toValidatorRewardData(rows.filter((r) => dayOf(r.day).startsWith(String(year))));
}

/** A validator's daily rewards in one year: owner fee, delegators' rewards and total stake. */
export async function getValidatorRewards(address: string, year: number): Promise<OlympiaValidatorDay[]> {
  const data = await fromDataset(address, year);
  const days = new Set([...Object.keys(data.daily), ...Object.keys(data.dailyDelegants ?? {})]);
  return [...days].filter((d) => d.startsWith(String(year))).sort().map((day) => ({
    day,
    feeXrd: data.daily[day] ?? 0,
    delegatorsXrd: data.dailyDelegants?.[day] ?? 0,
    totalStakeXrd: data.dailyStake?.[day] ?? 0,
  }));
}
