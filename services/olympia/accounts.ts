/**
 * services/olympia/accounts.ts
 *
 * Olympia accounts: finding one by its Olympia address or by the Babylon
 * account it became, and summarising what it held and did.
 *
 * Every Olympia account is a secp256k1 key; the Babylon account derived from
 * the same key (`account_rdx16…`) is where its balances went at the migration.
 * The dataset stores that pairing for all 175,567 accounts, so the link works
 * in both directions without asking the Babylon Gateway anything.
 */
import 'server-only';
import { OLYMPIA_XRD_RRI } from '@/features/dashboard/lib/olympia';
import type { OlympiaAccountSummary, OlympiaLink, OlympiaStake } from '@/types/olympia';
import { tokenCatalog, validatorCatalog } from './catalog';
import { OLYMPIA_FILES as F } from './files';
import { mapTokenAmount, toIso, toNum } from './mappers';
import { attoToNumber, readEq, type Row } from './parquet';

export interface OlympiaAccountRef {
  id: bigint;
  address: string;
  babylonAddress: string;
  publicKey: string;
  firstSeenStateVersion: number;
}

function refOf(r: Row, olympia: string, babylon: string): OlympiaAccountRef {
  return {
    id: BigInt(toNum(r.account_id)),
    address: olympia,
    babylonAddress: babylon,
    publicKey: String(r.public_key ?? ''),
    firstSeenStateVersion: toNum(r.from_state_version),
  };
}

export async function findAccountByOlympia(address: string): Promise<OlympiaAccountRef | null> {
  const [r] = await readEq(F.accountsByAddress.path, F.accountsByAddress.key, address);
  return r ? refOf(r, address, String(r.babylon_address)) : null;
}

/** The Olympia account a Babylon account comes from, if it existed on Olympia. */
export async function findLinkByBabylon(babylonAddress: string): Promise<OlympiaLink | null> {
  const [r] = await readEq(F.accountsByBabylon.path, F.accountsByBabylon.key, babylonAddress);
  return r ? { olympiaAddress: String(r.olympia_address), babylonAddress } : null;
}

export async function findAccountByBabylon(babylonAddress: string): Promise<OlympiaAccountRef | null> {
  const link = await findLinkByBabylon(babylonAddress);
  return link ? findAccountByOlympia(link.olympiaAddress) : null;
}

/** Final balances, stakes, activity and staking rewards of an Olympia account. */
export async function getAccountSummary(ref: OlympiaAccountRef): Promise<OlympiaAccountSummary> {
  const [balances, stakes, txs, rewards, tokens, validators] = await Promise.all([
    readEq(F.accountFinalBalances.path, F.accountFinalBalances.key, ref.id, ['account_id', 'rri', 'balance']),
    readEq(F.accountFinalStakes.path, F.accountFinalStakes.key, ref.id),
    readEq(F.accountTxs.path, F.accountTxs.key, ref.id, ['account_id', 'state_version', 'round_timestamp', 'fee_paid', 'is_fee_payer']),
    readEq(F.accountRewardsDaily.path, F.accountRewardsDaily.key, ref.id, ['account_id', 'day', 'delegator_reward_xrd', 'fee_reward_xrd']),
    tokenCatalog(),
    validatorCatalog(),
  ]);

  const amounts = balances.map((b) => mapTokenAmount(String(b.rri), b.balance, tokens));
  const xrd = amounts.find((a) => a.rri === OLYMPIA_XRD_RRI) ?? null;
  const others = amounts.filter((a) => a.rri !== OLYMPIA_XRD_RRI).sort((a, b) => b.amountNum - a.amountNum);

  const stakeRows: OlympiaStake[] = stakes.map((s) => {
    const units = toNum(s.total_stake_units);
    const pendingUnits = toNum(s.total_prepared_unstake_units);
    const vXrd = toNum(s.validator_total_xrd_staked);
    // Units being unstaked are still backed by the pool until the epoch change.
    const vUnits = toNum(s.validator_total_stake_units) + toNum(s.validator_total_prepared_unstake_units);
    const rate = vUnits > 0 ? vXrd / vUnits : 1;
    const validatorAddress = String(s.validator_address);
    return {
      validatorAddress,
      validatorName: validators.get(validatorAddress)?.name ?? null,
      stakedXrd: (units * rate) / 1e18,
      pendingStakeXrd: attoToNumber(s.total_prepared_xrd_stake),
      pendingUnstakeXrd: (pendingUnits * rate) / 1e18,
      exitingXrd: attoToNumber(s.total_exiting_xrd_stake),
    };
  }).sort((a, b) => b.stakedXrd - a.stakedXrd);

  const sum = (f: (s: OlympiaStake) => number) => stakeRows.reduce((acc, s) => acc + f(s), 0);
  const liquidXrd = xrd?.amountNum ?? 0;
  const stakedXrd = sum((s) => s.stakedXrd);
  const pendingStakeXrd = sum((s) => s.pendingStakeXrd);
  const unstakingXrd = sum((s) => s.pendingUnstakeXrd + s.exitingXrd);

  txs.sort((a, b) => toNum(a.state_version) - toNum(b.state_version));
  const first = txs[0];
  const last = txs[txs.length - 1];
  const point = (r: Row | undefined) => (r ? { stateVersion: toNum(r.state_version), timestamp: toIso(r.round_timestamp) } : null);

  const years = new Set<number>();
  let delegatorXrd = 0;
  let validatorFeeXrd = 0;
  for (const r of rewards) {
    delegatorXrd += toNum(r.delegator_reward_xrd);
    validatorFeeXrd += toNum(r.fee_reward_xrd);
    const day = toIso(r.day);
    if (day) years.add(Number(day.slice(0, 4)));
  }

  return {
    address: ref.address,
    babylonAddress: ref.babylonAddress,
    publicKey: ref.publicKey,
    firstSeenStateVersion: ref.firstSeenStateVersion,
    xrd,
    tokens: others,
    stakes: stakeRows,
    totals: { liquidXrd, stakedXrd, pendingStakeXrd, unstakingXrd, totalXrd: liquidXrd + stakedXrd + pendingStakeXrd + unstakingXrd },
    activity: {
      txCount: txs.length,
      firstTx: point(first),
      lastTx: point(last),
      feesPaidXrd: txs.reduce((acc, r) => acc + (r.is_fee_payer === true ? attoToNumber(r.fee_paid) : 0), 0),
    },
    rewards: { delegatorXrd, validatorFeeXrd, years: [...years].sort() },
  };
}
