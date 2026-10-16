// @vitest-environment node
/**
 * Native pool manifests against a real Radix Engine ledger (resim).
 *
 * Static validation only proves a manifest parses. These runs prove the
 * engine accepts it, and above all that the pool is guarded: an account
 * without the manager badge must be refused.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  contributeManifest,
  createPoolManifest,
  managePoolManifest,
  poolProfileManifest,
  protectedDepositManifest,
  protectedWithdrawManifest,
  redeemManifest,
  reserveMovesManifest,
  type PoolKind,
} from '@/features/console/lib/pool-manifests';
import {
  RESIM,
  ResimLedger,
  expectCommitted,
  simulatorPackages,
  type ResimAccount,
} from '../helpers/resim';

describe.skipIf(!RESIM)('native pools on resim', () => {
  let ledger: ResimLedger;
  let creator: ResimAccount;
  let stranger: ResimAccount;
  let tokenA = '';
  let tokenB = '';
  let tokenC = '';
  let packages: Awaited<ReturnType<typeof simulatorPackages>>;

  beforeAll(async () => {
    packages = await simulatorPackages();
    ledger = new ResimLedger();
    creator = ledger.newAccount();
    stranger = ledger.newAccount();
    ledger.use(creator);
    tokenA = ledger.newToken('1000000', 'Alpha');
    tokenB = ledger.newToken('1000000', 'Beta');
    tokenC = ledger.newToken('1000000', 'Gamma');
  });

  afterAll(() => ledger?.dispose());

  /** Creates a pool guarded by a fresh badge; returns its addresses. */
  function createPool(kind: PoolKind, resources: string[]) {
    ledger.use(creator);
    const manifest = createPoolManifest({
      account: creator.address,
      kind,
      resources,
      manager: { mode: 'newBadge', badgeName: 'Pool manager' },
      packages,
    });
    const run = ledger.run(manifest, creator.address);
    expectCommitted(run, manifest);
    const pool = run.newEntities.find((a) => a.startsWith('pool_sim1'))!;
    const resourcesCreated = run.newEntities.filter((a) => a.startsWith('resource_sim1'));
    // The badge is reserved first, so it is the first resource; the pool unit follows.
    const [badge, poolUnit] = resourcesCreated;
    expect(pool).toBeTruthy();
    expect(ledger.balance(creator.address, badge)).toBe('1');
    return { pool, badge, poolUnit };
  }

  describe('two-resource pool', () => {
    let pool = '';
    let badge = '';
    let poolUnit = '';

    beforeAll(() => {
      ({ pool, badge, poolUnit } = createPool('two', [tokenA, tokenB]));
    });

    it('lets the badge holder contribute and mints pool units', () => {
      const manifest = contributeManifest({
        account: creator.address,
        pool,
        kind: 'two',
        contributions: [
          { resource: tokenA, amount: '100' },
          { resource: tokenB, amount: '400' },
        ],
        manager: { account: creator.address, resource: badge },
      });
      expectCommitted(ledger.run(manifest, creator.address), manifest);
      expect(Number(ledger.balance(creator.address, poolUnit))).toBeGreaterThan(0);
    });

    it('refuses a contribution from an account without the badge', () => {
      ledger.use(creator);
      ledger.exec('transfer', `${tokenA}:10`, stranger.address);
      ledger.exec('transfer', `${tokenB}:40`, stranger.address);
      ledger.use(stranger);
      // The stranger cannot even present the proof, so build the call bare.
      const manifest = `
CALL_METHOD Address("${stranger.address}") "withdraw" Address("${tokenA}") Decimal("10");
TAKE_FROM_WORKTOP Address("${tokenA}") Decimal("10") Bucket("a");
CALL_METHOD Address("${stranger.address}") "withdraw" Address("${tokenB}") Decimal("40");
TAKE_FROM_WORKTOP Address("${tokenB}") Decimal("40") Bucket("b");
CALL_METHOD Address("${pool}") "contribute" Tuple(Bucket("a"), Bucket("b"));
CALL_METHOD Address("${stranger.address}") "deposit_batch" Expression("ENTIRE_WORKTOP");
`;
      const run = ledger.run(manifest, stranger.address);
      expect(run.committed).toBe(false);
      expect(run.output).toMatch(/Unauthorized|AuthZone|assertion/i);
    });

    it('refuses a protected withdraw from an account without the badge', () => {
      ledger.use(stranger);
      const manifest = `
CALL_METHOD Address("${pool}") "protected_withdraw" Address("${tokenA}") Decimal("1") Enum<0u8>();
CALL_METHOD Address("${stranger.address}") "deposit_batch" Expression("ENTIRE_WORKTOP");
`;
      expect(ledger.run(manifest, stranger.address).committed).toBe(false);
    });

    it('moves reserves with protected deposit and withdraw', () => {
      ledger.use(creator);
      const deposit = protectedDepositManifest({
        account: creator.address,
        pool,
        kind: 'two',
        resource: tokenA,
        amount: '50',
        manager: { account: creator.address, resource: badge },
      });
      expectCommitted(ledger.run(deposit, creator.address), deposit);

      const before = Number(ledger.balance(creator.address, tokenB));
      const withdraw = protectedWithdrawManifest({
        account: creator.address,
        pool,
        kind: 'two',
        resource: tokenB,
        amount: '20',
        manager: { account: creator.address, resource: badge },
      });
      expectCommitted(ledger.run(withdraw, creator.address), withdraw);
      expect(Number(ledger.balance(creator.address, tokenB))).toBe(before + 20);
    });

    it('moves several reserves in one transaction', () => {
      ledger.use(creator);
      const manager = { account: creator.address, resource: badge };
      const beforeA = Number(ledger.balance(creator.address, tokenA));
      const beforeB = Number(ledger.balance(creator.address, tokenB));
      const deposit = reserveMovesManifest({
        account: creator.address,
        pool,
        kind: 'two',
        direction: 'deposit',
        moves: [
          { resource: tokenA, amount: '3' },
          { resource: tokenB, amount: '4' },
        ],
        manager,
      });
      expectCommitted(ledger.run(deposit, creator.address), deposit);
      const withdraw = reserveMovesManifest({
        account: creator.address,
        pool,
        kind: 'two',
        direction: 'withdraw',
        moves: [
          { resource: tokenA, amount: '1' },
          { resource: tokenB, amount: '' },
        ],
        manager,
      });
      expect(withdraw.match(/protected_withdraw/g)).toHaveLength(1);
      expectCommitted(ledger.run(withdraw, creator.address), withdraw);
      expect(Number(ledger.balance(creator.address, tokenA))).toBe(beforeA - 3 + 1);
      expect(Number(ledger.balance(creator.address, tokenB))).toBe(beforeB - 4);
    });

    it('lets anyone redeem pool units, no badge needed', () => {
      ledger.use(creator);
      ledger.exec('transfer', `${poolUnit}:10`, stranger.address);
      ledger.use(stranger);
      const before = Number(ledger.balance(stranger.address, tokenA));
      const manifest = redeemManifest({ account: stranger.address, pool, poolUnit, amount: '10' });
      expectCommitted(ledger.run(manifest, stranger.address), manifest);
      expect(Number(ledger.balance(stranger.address, tokenA))).toBeGreaterThan(before);
      expect(ledger.balance(stranger.address, poolUnit)).toBe('0');
    });

    it('writes the pool and pool unit profile with the owner badge', () => {
      ledger.use(creator);
      const manifest = poolProfileManifest({
        owner: { account: creator.address, resource: badge },
        pool,
        poolUnit,
        poolFields: { name: 'Alpha/Beta pool', description: 'Test pool', infoUrl: 'https://example.com' },
        unitFields: { name: 'Alpha/Beta LP', symbol: 'ABLP', iconUrl: 'https://example.com/lp.png' },
      });
      expectCommitted(ledger.run(manifest, creator.address), manifest);
      expect(ledger.show(pool)).toContain('Alpha/Beta pool');
      expect(ledger.show(poolUnit)).toContain('ABLP');
    });

    it('refuses the profile without the owner badge', () => {
      ledger.use(stranger);
      const manifest = `SET_METADATA Address("${pool}") "name" Enum<Metadata::String>("hijacked");`;
      expect(ledger.run(manifest, stranger.address).committed).toBe(false);
    });
  });

  it('winds a pool down: empties it, tags it retired and locks its owner, in one transaction', () => {
    const { pool, badge, poolUnit } = createPool('two', [tokenA, tokenB]);
    const proof = { account: creator.address, resource: badge };
    const fund = contributeManifest({
      account: creator.address,
      pool,
      kind: 'two',
      contributions: [
        { resource: tokenA, amount: '100' },
        { resource: tokenB, amount: '200' },
      ],
      manager: proof,
    });
    expectCommitted(ledger.run(fund, creator.address), fund);

    const beforeA = Number(ledger.balance(creator.address, tokenA));
    const beforeB = Number(ledger.balance(creator.address, tokenB));
    const manifest = managePoolManifest({
      account: creator.address,
      pool,
      kind: 'two',
      poolUnit,
      reserves: { [tokenA]: '100', [tokenB]: '200' },
      manager: proof,
      owner: proof,
      empty: true,
      retire: { poolTags: ['defi'], unitTags: [] },
      lockOwner: true,
    });
    // One badge fills both roles: a single proof.
    expect(manifest.match(/create_proof_of_amount/g)).toHaveLength(1);
    expectCommitted(ledger.run(manifest, creator.address), manifest);

    expect(Number(ledger.balance(creator.address, tokenA))).toBe(beforeA + 100);
    expect(Number(ledger.balance(creator.address, tokenB))).toBe(beforeB + 200);
    expect(ledger.show(pool)).toContain('retired');
    expect(ledger.show(pool)).toContain('defi');
    expect(ledger.show(poolUnit)).toContain('retired');

    // The profile is frozen: not even the badge can write it now, set or not.
    const rename = `${'CALL_METHOD Address("' + creator.address + '") "create_proof_of_amount" Address("' + badge + '") Decimal("1");'}
SET_METADATA Address("${pool}") "name" Enum<Metadata::String>("renamed");`;
    const renamed = ledger.run(rename, creator.address);
    expect(renamed.committed).toBe(false);
    expect(renamed.output).toMatch(/Locked/i);
    const setIcon = rename.replace('"name" Enum<Metadata::String>("renamed")', '"icon_url" Enum<Metadata::Url>("https://example.com/x.png")');
    const iconRun = ledger.run(setIcon, creator.address);
    expect(iconRun.committed).toBe(false);
    expect(iconRun.output).toMatch(/Locked/i);
  });

  it('creates and funds a one-resource pool', () => {
    const { pool, badge, poolUnit } = createPool('one', [tokenA]);
    const manifest = contributeManifest({
      account: creator.address,
      pool,
      kind: 'one',
      contributions: [{ resource: tokenA, amount: '25' }],
      manager: { account: creator.address, resource: badge },
    });
    expectCommitted(ledger.run(manifest, creator.address), manifest);
    expect(ledger.balance(creator.address, poolUnit)).toBe('25');

    // A one-resource pool's protected_withdraw takes no resource address.
    const before = Number(ledger.balance(creator.address, tokenA));
    const withdraw = protectedWithdrawManifest({
      account: creator.address,
      pool,
      kind: 'one',
      resource: tokenA,
      amount: '5',
      manager: { account: creator.address, resource: badge },
    });
    expectCommitted(ledger.run(withdraw, creator.address), withdraw);
    expect(Number(ledger.balance(creator.address, tokenA))).toBe(before + 5);

    const wind = managePoolManifest({
      account: creator.address,
      pool,
      kind: 'one',
      poolUnit,
      reserves: { [tokenA]: '20' },
      manager: { account: creator.address, resource: badge },
      owner: { account: creator.address, resource: badge },
      empty: true,
      retire: { poolTags: [], unitTags: [] },
    });
    expectCommitted(ledger.run(wind, creator.address), wind);
    expect(Number(ledger.balance(creator.address, tokenA))).toBe(before + 25);
    expect(ledger.show(pool)).toContain('retired');
  });

  it('creates and funds a multi-resource pool', () => {
    const { pool, badge, poolUnit } = createPool('multi', [tokenA, tokenB, tokenC]);
    const manifest = contributeManifest({
      account: creator.address,
      pool,
      kind: 'multi',
      contributions: [
        { resource: tokenA, amount: '10' },
        { resource: tokenB, amount: '20' },
        { resource: tokenC, amount: '30' },
      ],
      manager: { account: creator.address, resource: badge },
    });
    expectCommitted(ledger.run(manifest, creator.address), manifest);
    expect(Number(ledger.balance(creator.address, poolUnit))).toBeGreaterThan(0);
  });

  it('guards a pool with a badge the creator already holds', () => {
    ledger.use(creator);
    const badge = ledger.newBadge('Existing admin');
    const manifest = createPoolManifest({
      account: creator.address,
      kind: 'two',
      resources: [tokenB, tokenC],
      manager: { mode: 'existingBadge', resource: badge },
      packages,
    });
    const run = ledger.run(manifest, creator.address);
    expectCommitted(run, manifest);
    const pool = run.newEntities.find((a) => a.startsWith('pool_sim1'))!;

    const contribute = contributeManifest({
      account: creator.address,
      pool,
      kind: 'two',
      contributions: [
        { resource: tokenB, amount: '5' },
        { resource: tokenC, amount: '5' },
      ],
      manager: { account: creator.address, resource: badge },
    });
    expectCommitted(ledger.run(contribute, creator.address), contribute);
  });

  it('writes the pool profile and the badge details in the creating transaction', () => {
    ledger.use(creator);
    for (const manager of [
      { mode: 'newBadge' as const, badgeName: 'Profile badge', badgeSymbol: 'PBDG', badgeDescription: 'Manages the pool', badgeIconUrl: 'https://example.com/b.png' },
      { mode: 'existingBadge' as const, resource: ledger.newBadge('Existing profile admin') },
    ]) {
      const manifest = createPoolManifest({
        account: creator.address,
        kind: 'two',
        resources: [tokenA, tokenC],
        manager,
        packages,
        profile: { name: 'Test pool', description: 'A pool for tests', iconUrl: 'https://example.com/p.png', infoUrl: 'https://example.com' },
      });
      const run = ledger.run(manifest, creator.address);
      expectCommitted(run, manifest);
      const pool = run.newEntities.find((a) => a.startsWith('pool_sim1'))!;
      const shown = ledger.show(pool);
      expect(shown).toContain('Test pool');
      expect(shown).toContain('https://example.com/p.png');
      if (manager.mode === 'newBadge') {
        const badge = run.newEntities.filter((a) => a.startsWith('resource_sim1'))[0];
        expect(ledger.balance(creator.address, badge)).toBe('1');
        expect(ledger.show(badge)).toContain('PBDG');
      }
    }
  });
});
