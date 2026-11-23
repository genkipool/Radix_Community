import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RESIM, ResimLedger, SIM_XRD } from '@/__tests__/helpers/resim';
import {
  buildBatchStakeManifest,
  buildBatchUnstakeManifest,
  buildClaimManifest,
  buildMixedBatchManifest,
  buildStakeManifest,
  buildUnstakeManifest,
} from '@/features/wallet/lib/manifest-builders';
import {
  minRadixDecimal,
  splitRadixDecimal,
  sumRadixDecimals,
  toRadixDecimal,
} from '@/features/wallet/lib/radix-decimal';

describe('radix-decimal fixed-point arithmetic', () => {
  it('converts scientific notation and truncates beyond 18 decimals without rounding up', () => {
    expect(toRadixDecimal(1e-7)).toBe('0.0000001');
    expect(toRadixDecimal('5e-18')).toBe('0.000000000000000005');
    // Truncates 19th decimal instead of rounding up above a vault balance
    expect(toRadixDecimal('1234.5678901234567890129')).toBe('1234.567890123456789012');
    expect(toRadixDecimal('100.0000')).toBe('100');
  });

  it('rejects negative, NaN, and infinite values', () => {
    expect(() => toRadixDecimal(-1)).toThrow();
    expect(() => toRadixDecimal(Number.NaN)).toThrow();
    expect(() => toRadixDecimal(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('computes exact decimal sums without IEEE-754 float64 drift', () => {
    // In JS float64: 1.1 + 1.2 + 1.3 === 3.5999999999999996 < 3.6
    expect(sumRadixDecimals([1.1, 1.2, 1.3])).toBe('3.6');
    // In JS float64: 10.1 + 20.2 + 30.3 === 60.599999999999994 < 60.6
    expect(sumRadixDecimals([10.1, 20.2, 30.3])).toBe('60.6');
  });

  it('splits totals into equal 18-decimal shares whose exact sum never exceeds the total', () => {
    const shares = splitRadixDecimal('10', 3);
    expect(shares).toEqual([
      '3.333333333333333333',
      '3.333333333333333333',
      '3.333333333333333333',
    ]);
    expect(sumRadixDecimals(shares)).toBe('9.999999999999999999');
  });

  it('clamps withdrawal amounts to the exact 18-decimal vault balance', () => {
    // Simulates float64 rounding UP a 18-decimal LSU balance
    const exactVault = '1234.567890123456789012';
    const floatRoundedUp = String(parseFloat(exactVault)); // 1234.5678901234568 > exactVault
    expect(minRadixDecimal(floatRoundedUp, exactVault)).toBe(exactVault);
    expect(minRadixDecimal('500.25', exactVault)).toBe('500.25');
  });
});

describe.skipIf(!RESIM)('staking, unstaking & claim manifests on resim', () => {
  let ledger: ResimLedger;
  let account: string;
  let validator: string;
  let ownerBadgeRes: string;
  let ownerBadgeId: string;
  let lsuRes: string;

  beforeAll(() => {
    ledger = new ResimLedger();
    const acc = ledger.newAccount();
    account = acc.address;
    ledger.use(acc);

    // Create validator and enable delegated stake
    const keyHex = `02${'11'.repeat(32)}`;
    const created = ledger.run(
      `
CALL_METHOD Address("${account}") "withdraw" Address("${SIM_XRD}") Decimal("2000");
TAKE_FROM_WORKTOP Address("${SIM_XRD}") Decimal("2000") Bucket("b");
CREATE_VALIDATOR Bytes("${keyHex}") Decimal("0.01") Bucket("b");
CALL_METHOD Address("${account}") "deposit_batch" Expression("ENTIRE_WORKTOP");
`,
      account,
    );
    expect(created.committed).toBe(true);
    validator = created.output.match(/(validator_sim1\w+)/)![1];

    const showAcc = ledger.exec('show', account);
    ownerBadgeRes = showAcc.match(/(resource_sim1nf\w*vdrwnr\w*)/)![1];
    const badgeSection = showAcc.slice(showAcc.indexOf(ownerBadgeRes));
    ownerBadgeId = badgeSection.match(/\[[0-9a-f]+\]/)![0];

    const accept = ledger.run(
      `
CALL_METHOD Address("${account}") "create_proof_of_non_fungibles" Address("${ownerBadgeRes}") Array<NonFungibleLocalId>(NonFungibleLocalId("${ownerBadgeId}"));
CALL_METHOD Address("${validator}") "update_accept_delegated_stake" true;
`,
      account,
    );
    expect(accept.committed, accept.output).toBe(true);
  });

  afterAll(() => {
    ledger?.dispose();
  });

  it('commits batch stake with 10 / 3 split without WorktopError::InsufficientBalance', () => {
    const shares = splitRadixDecimal('10', 3);
    const manifest = buildBatchStakeManifest(
      account,
      shares.map((amountXrd) => ({ validatorAddress: validator, amountXrd })),
      SIM_XRD,
    );
    const res = ledger.run(manifest, account);
    expect(res.committed, res.output).toBe(true);

    const showAcc = ledger.exec('show', account);
    lsuRes = [...showAcc.matchAll(/(resource_sim1t\w+)/g)]
      .map((m) => m[1])
      .find((r) => r !== SIM_XRD)!;
    expect(lsuRes).toBeTruthy();
  });

  it('commits mixed cart stake with float-drift amounts (1.1 + 1.2 + 1.3)', () => {
    const manifest = buildMixedBatchManifest(
      account,
      [
        { action: 'Stake', validatorAddress: validator, amountXrd: 1.1 },
        { action: 'Stake', validatorAddress: validator, amountXrd: 1.2 },
        { action: 'Stake', validatorAddress: validator, amountXrd: 1.3 },
      ],
      SIM_XRD,
    );
    const res = ledger.run(manifest, account);
    expect(res.committed, res.output).toBe(true);
  });

  it('commits single stake with very small decimal (no scientific notation) and exact-balance unstake + claim', () => {
    const smallStake = buildStakeManifest(account, validator, 1e-7, SIM_XRD);
    expect(smallStake).toContain('Decimal("0.0000001")');
    expect(smallStake).not.toMatch(/e-/i);
    expect(ledger.run(smallStake, account).committed).toBe(true);

    // Unstake partial and then unstake remaining exact balance
    const partialUnstake = buildUnstakeManifest(account, validator, '5', lsuRes);
    const partialRes = ledger.run(partialUnstake, account);
    expect(partialRes.committed, partialRes.output).toBe(true);

    // Read exact LSU balance from resim and unstake 100% of it via batch unstake
    const showAcc = ledger.exec('show', account);
    const lsuLine = showAcc.split('\n').find((line) => line.includes(lsuRes)) ?? '';
    const exactLsu = lsuLine.match(/amount:\s*([0-9.]+)/)?.[1] ?? '1';
    const fullUnstake = buildBatchUnstakeManifest(account, [
      { validatorAddress: validator, amountLsu: exactLsu, lsuResourceAddress: lsuRes },
    ]);
    const fullRes = ledger.run(fullUnstake, account);
    expect(fullRes.committed, fullRes.output).toBe(true);

    // Extract exact claim NFT resource & local id from the unstake transaction output
    const claimRes = partialRes.output.match(/ResAddr:\s*(resource_sim1n\w+)/)![1];
    const claimIds = [
      ...new Set(
        [...partialRes.output.matchAll(/\{[0-9a-f-]+\}/g)].map((m) => m[0]),
      ),
    ];

    expect(claimRes).toBeTruthy();
    expect(claimIds.length).toBeGreaterThan(0);

    // Claiming before maturity must fail; advancing epoch makes claim commit cleanly
    const earlyClaim = ledger.run(buildClaimManifest(account, validator, claimIds, claimRes), account);
    expect(earlyClaim.committed).toBe(false);

    ledger.exec('set-current-epoch', '5000');
    const claimManifest = buildClaimManifest(account, validator, claimIds, claimRes);
    const claimResRun = ledger.run(claimManifest, account);
    expect(claimResRun.committed, claimResRun.output).toBe(true);
  });

  it('commits owner-mode stake, unstake, and claim via buildMixedBatchManifest', () => {
    const ownerStakeAndUnstake = buildMixedBatchManifest(
      account,
      [
        {
          action: 'OwnerStake',
          validatorAddress: validator,
          amountXrd: '25',
          lsuResourceAddress: lsuRes,
          ownerBadgeId,
          ownerBadgeResourceAddress: ownerBadgeRes,
        },
        {
          action: 'OwnerUnstake',
          validatorAddress: validator,
          amountLsu: '10',
          ownerBadgeId,
          ownerBadgeResourceAddress: ownerBadgeRes,
        },
      ],
      SIM_XRD,
    );
    const res1 = ledger.run(ownerStakeAndUnstake, account);
    expect(res1.committed, res1.output).toBe(true);

    ledger.exec('set-current-epoch', '10000');
    const ownerClaim = buildMixedBatchManifest(
      account,
      [
        {
          action: 'OwnerClaim',
          validatorAddress: validator,
          ownerBadgeId,
          ownerBadgeResourceAddress: ownerBadgeRes,
        },
      ],
      SIM_XRD,
    );
    const res2 = ledger.run(ownerClaim, account);
    expect(res2.committed, res2.output).toBe(true);
  });
});
