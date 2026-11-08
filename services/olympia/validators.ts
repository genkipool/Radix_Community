/**
 * services/olympia/validators.ts
 *
 * Olympia validators: final registration data, stake and delegators, and the
 * rewards they paid out over the life of Olympia.
 */
import 'server-only';
import type { OlympiaValidator } from '@/types/olympia';
import { validatorCatalog } from './catalog';
// Worked out once from validator_proposal_records (scripts/olympia/build-validator-uptime.mjs).
import uptime from './data/validator-uptime.json';
// The archive's stake movements indexed by validator and day, built once by
// scripts/olympia/build-validator-stake-activity.mjs (the archive sorts them by transaction only).
import stakeActivity from './data/validator-stake-activity.json';
import { OLYMPIA_FILES as F } from './files';
import { toIso, toNum } from './mappers';
import { attoToNumber, readEq } from './parquet';

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function proposalsOf(address: string): OlympiaValidator['proposals'] {
  const p = (uptime as Record<string, { completed: number; missed: number }>)[address];
  if (!p || p.completed + p.missed === 0) return null;
  return { ...p, uptimePercent: (p.completed / (p.completed + p.missed)) * 100 };
}

const byStakeDesc = (a: Record<string, unknown>, b: Record<string, unknown>) => toNum(b.staked_xrd) - toNum(a.staked_xrd);

/**
 * A page of a validator's delegators when Olympia ended, biggest stake first.
 * One row group per validator, so every page costs the same small read.
 */
export async function getValidatorDelegators(address: string, offset: number, limit: number): Promise<{ items: { address: string; stakedXrd: number }[]; total: number }> {
  const rows = await readEq(F.delegatorsByValidator.path, F.delegatorsByValidator.key, address, ['validator_address', 'account_address', 'staked_xrd']);
  rows.sort(byStakeDesc);
  return {
    items: rows.slice(offset, offset + limit).map((d) => ({ address: String(d.account_address), stakedXrd: toNum(d.staked_xrd) })),
    total: rows.length,
  };
}

export async function getValidator(address: string, topDelegators = 50): Promise<OlympiaValidator | null> {
  const [[v], delegators, rewards, catalog] = await Promise.all([
    readEq(F.validatorsByAddress.path, F.validatorsByAddress.key, address),
    readEq(F.delegatorsByValidator.path, F.delegatorsByValidator.key, address, ['validator_address', 'account_address', 'staked_xrd']),
    readEq(F.validatorRewardsDaily.path, F.validatorRewardsDaily.key, address, ['validator_address', 'day', 'delegators_reward_xrd', 'fee_reward_xrd', 'total_stake_xrd']),
    validatorCatalog(),
  ]);
  if (!v) return null;
  delegators.sort(byStakeDesc);
  const owner = str(v.owner_address);
  const years = new Set<number>();
  let delegatorsXrd = 0;
  let ownerFeeXrd = 0;
  const stakeHistory: { day: string; stakeXrd: number }[] = [];
  for (const r of rewards) {
    delegatorsXrd += toNum(r.delegators_reward_xrd);
    ownerFeeXrd += toNum(r.fee_reward_xrd);
    const day = toIso(r.day);
    if (day) {
      years.add(Number(day.slice(0, 4)));
      stakeHistory.push({ day: day.slice(0, 10), stakeXrd: toNum(r.total_stake_xrd) });
    }
  }
  stakeHistory.sort((a, b) => a.day.localeCompare(b.day));

  const totalStakedXrd = attoToNumber(v.total_xrd_staked ?? '0');
  const units = attoToNumber(v.total_stake_units ?? '0');
  let networkXrd = 0;
  for (const info of catalog.values()) networkXrd += info.totalXrdStaked;
  const ownerRow = owner ? delegators.find((d) => String(d.account_address) === owner) : undefined;
  // The Olympia Gateway stores the fee already as a percentage (100 = 100 %);
  // the node's own unit (hundredths, RAKE_MAX = 10000) was converted on ingest.
  const fee = v.fee_percentage === null || v.fee_percentage === undefined ? null : toNum(v.fee_percentage);
  return {
    address,
    name: str(v.name),
    url: str(v.url),
    feePercent: fee,
    isRegistered: typeof v.is_registered === 'boolean' ? v.is_registered : null,
    allowDelegation: typeof v.allow_delegation === 'boolean' ? v.allow_delegation : null,
    owner,
    publicKey: str(v.public_key)?.toLowerCase() ?? null,
    totalStakedXrd,
    delegators: delegators.length,
    topDelegators: delegators.slice(0, topDelegators).map((d) => ({ address: String(d.account_address), stakedXrd: toNum(d.staked_xrd) })),
    rewards: { delegatorsXrd, ownerFeeXrd, years: [...years].sort() },
    ownerStakeXrd: ownerRow ? toNum(ownerRow.staked_xrd) : null,
    networkSharePercent: networkXrd > 0 ? (totalStakedXrd / networkXrd) * 100 : null,
    xrdPerStakeUnit: units > 0 ? totalStakedXrd / units : null,
    stakeHistory,
    proposals: proposalsOf(address),
    stakeActivity: ((stakeActivity as unknown as Record<string, [string, number, number][]>)[address] ?? []).map(([day, stake, unstake]) => ({ day, stake, unstake })),
  };
}

