// @vitest-environment node
/**
 * The Olympia services against the real dataset, when a local copy is
 * available (OLYMPIA_TEST_DATA, default ~/olympia-archive/parquet). Skipped
 * otherwise, so CI without the 50 GB archive is unaffected.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { beforeAll, describe, expect, it } from 'vitest';

const DATA = process.env.OLYMPIA_TEST_DATA ?? `${homedir()}/olympia-archive/parquet`;
const HAS_DATA = existsSync(`${DATA}/index/accounts_by_address.parquet`);

const OWNER_BABYLON = 'account_rdx168u7hevd7s30a3hj8cu6qvp4ffehm5f3xvzet3gspdsdc2cq7y6tjq';
const OWNER_OLYMPIA = 'rdx1qspxhhwwhfqpzprvkfgz6ytkdxvqcy6e65nmdv0cdvs8dar2szenq3gruxhkv';
const GENKIPOOL = 'rv1q0rd59efueuu80mg8jedescygakhee8jvc8fcz92k4gjyrhxf9dmxqsjrxm';

type Olympia = typeof import('@/services/olympia');
let O: Olympia;

describe.skipIf(!HAS_DATA)('Olympia dataset services', () => {
  beforeAll(async () => {
    process.env.OLYMPIA_DATA_BASE_URL = DATA;
    O = await import('@/services/olympia');
  });

  it('links a Babylon account to its Olympia account both ways', async () => {
    const link = await O.findLinkByBabylon(OWNER_BABYLON);
    expect(link?.olympiaAddress).toBe(OWNER_OLYMPIA);
    const ref = await O.findAccountByOlympia(OWNER_OLYMPIA);
    expect(ref?.babylonAddress).toBe(OWNER_BABYLON);
    expect(await O.findLinkByBabylon('account_rdx12xezaw0gn9yhld6kplsrgvsckm8e7cqjh3p3gu0yy2tm9l3cnr6bcl')).toBeNull();
  });

  it('summarises an account: final balances, stakes, activity, rewards', async () => {
    const ref = (await O.findAccountByOlympia(OWNER_OLYMPIA))!;
    const s = await O.getAccountSummary(ref);
    expect(s.xrd?.symbol).toBe('XRD');
    expect(s.stakes[0].validatorName).toBe('GENKIPOOL');
    expect(s.activity.txCount).toBeGreaterThan(0);
    expect(s.rewards.years).toEqual([2021, 2022, 2023]);
    expect(s.rewards.validatorFeeXrd).toBeGreaterThan(0);
    expect(s.totals.totalXrd).toBeCloseTo(s.totals.liquidXrd + s.totals.stakedXrd + s.totals.pendingStakeXrd + s.totals.unstakingXrd);
  });

  it('reads an account at the last state version exactly as its final summary', async () => {
    const ref = (await O.findAccountByOlympia(OWNER_OLYMPIA))!;
    const [end, final] = await Promise.all([O.getAccountStateAt(ref, 337_759_839), O.getAccountSummary(ref)]);
    expect(end.xrd?.amount).toBe(final.xrd?.amount);
    expect(end.tokens.map((t) => [t.rri, t.amount])).toEqual(final.tokens.map((t) => [t.rri, t.amount]));
    expect(end.stakes.map((s) => s.validatorAddress)).toEqual(final.stakes.map((s) => s.validatorAddress));
    end.stakes.forEach((s, i) => expect(s.stakedXrd).toBeCloseTo(final.stakes[i].stakedXrd, 6));
  });

  it('reads an account at a past day: nothing before it existed, something in between', async () => {
    const ref = (await O.findAccountByOlympia(OWNER_OLYMPIA))!;
    const before = await O.getAccountStateAt(ref, ref.firstSeenStateVersion - 1);
    expect(before.totals.totalXrd).toBe(0);
    const mid = await O.getAccountStateAt(ref, O.versionAtDayEnd('2022-06-30')!, '2022-06-30');
    expect(mid.totals.totalXrd).toBeGreaterThan(0);
  });

  it('pages transactions newest first without gaps or repeats', async () => {
    const ref = (await O.findAccountByOlympia(OWNER_OLYMPIA))!;
    const p1 = await O.getAccountTxPage(ref, null, 5);
    const p2 = await O.getAccountTxPage(ref, BigInt(p1.nextCursor!), 5);
    const versions = [...p1.items, ...p2.items].map((t) => t.stateVersion);
    expect(versions).toEqual([...versions].sort((a, b) => b - a));
    expect(new Set(versions).size).toBe(10);
    expect(p1.items[0].actions.length).toBeGreaterThan(0);
  });

  it('finds a transaction by id, in any case', async () => {
    const ref = (await O.findAccountByOlympia(OWNER_OLYMPIA))!;
    const [first] = (await O.getAccountTxPage(ref, null, 1)).items;
    const tx = await O.getTransactionById(first.transactionId.toUpperCase());
    expect(tx?.stateVersion).toBe(first.stateVersion);
    expect(tx?.rawHex?.length).toBeGreaterThan(0);
    expect(await O.getTransactionById('0'.repeat(64))).toBeNull();
  });

  it('describes tokens and validators', async () => {
    const xrd = await O.getResource('xrd_rr1qy5wfsfh', 3);
    expect(xrd?.babylonAddress).toBe('resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd');
    expect(xrd?.topHolders).toHaveLength(3);
    expect(xrd!.topHolders[0].amountNum).toBeGreaterThanOrEqual(xrd!.topHolders[1].amountNum);
    expect(await O.findRriByBabylon(xrd!.babylonAddress!)).toBe('xrd_rr1qy5wfsfh');
    const v = await O.getValidator(GENKIPOOL);
    expect(v?.name).toBe('GENKIPOOL');
    expect(v?.owner).toBe(OWNER_OLYMPIA);
    // Stored as a percentage: GENKIPOOL charged 2 %.
    expect(v?.feePercent).toBe(2);
  });

  it('reads rewards per day for accounts and validators', async () => {
    const ref = (await O.findAccountByOlympia(OWNER_OLYMPIA))!;
    const days = await O.getAccountRewards(ref.id, 2022);
    expect(days.length).toBeGreaterThan(300);
    expect(days.every((d) => d.day.startsWith('2022'))).toBe(true);
    const vdays = await O.getValidatorRewards(GENKIPOOL, 2022);
    expect(vdays.length).toBeGreaterThan(300);
    // The owner's fee in a day equals the validator's fee that day (a single owner).
    const fee = (d: string) => days.filter((x) => x.day === d && x.validatorAddress === GENKIPOOL).reduce((a, x) => a + x.feeXrd, 0);
    expect(vdays[0].feeXrd).toBeCloseTo(fee(vdays[0].day), 6);
  });

  it('builds the funds flow from Olympia transfers', async () => {
    const ref = (await O.findAccountByOlympia(OWNER_OLYMPIA))!;
    const f = await O.readOlympiaFunds(ref);
    expect(f.received).toBeGreaterThan(0);
    expect(f.counterparties.every((c) => c.address.startsWith('rdx1'))).toBe(true);
  });
});
