// @vitest-environment node
/**
 * AccountLocker airdrops against a real Radix Engine ledger (resim): direct
 * delivery to accounts that accept, storage for those that refuse, claiming
 * by the recipient only, and recovery by the badge holder.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  airdropManifest,
  claimFromLockersManifest,
  claimManifest,
  createLockerAndAirdropManifest,
  createLockerManifest,
  recoverAllManifest,
  recoverManifest,
  withdrawManifest,
} from '@/features/console/lib/locker-manifests';
import {
  RESIM,
  ResimLedger,
  expectCommitted,
  simulatorPackages,
  type ResimAccount,
} from '../helpers/resim';

describe.skipIf(!RESIM)('account locker on resim', () => {
  let ledger: ResimLedger;
  let sender: ResimAccount;
  let accepter: ResimAccount;
  let refuser: ResimAccount;
  let stranger: ResimAccount;
  let token = '';
  let locker = '';
  let badge = '';
  let lockerPackage = '';
  let resourcePackage = '';

  beforeAll(async () => {
    const packages = await simulatorPackages();
    lockerPackage = packages.locker;
    resourcePackage = packages.resource;
    ledger = new ResimLedger();
    sender = ledger.newAccount();
    accepter = ledger.newAccount();
    refuser = ledger.newAccount();
    stranger = ledger.newAccount();

    ledger.use(refuser);
    expectCommitted(
      ledger.run(
        `CALL_METHOD Address("${refuser.address}") "set_default_deposit_rule" Enum<DefaultDepositRule::Reject>();`,
        refuser.address,
      ),
    );

    ledger.use(sender);
    token = ledger.newToken('1000000', 'Drop');
    const manifest = createLockerManifest({ account: sender.address, allowRecover: true, lockerPackage });
    const run = ledger.run(manifest, sender.address);
    expectCommitted(run, manifest);
    locker = run.newEntities.find((a) => a.startsWith('locker_sim1'))!;
    badge = run.newEntities.find((a) => a.startsWith('resource_sim1'))!;
    expect(locker).toBeTruthy();
    expect(ledger.balance(sender.address, badge)).toBe('1');
  });

  afterAll(() => ledger?.dispose());

  it('delivers directly to accounts that accept and stores the rest', () => {
    ledger.use(sender);
    const manifest = airdropManifest({
      account: sender.address,
      locker,
      badge: { account: sender.address, resource: badge },
      resource: token,
      claimants: [
        { account: accepter.address, amount: '10' },
        { account: refuser.address, amount: '25' },
      ],
      tryDirectSend: true,
    });
    expectCommitted(ledger.run(manifest, sender.address), manifest);
    expect(ledger.balance(accepter.address, token)).toBe('10');
    expect(ledger.balance(refuser.address, token)).toBe('0');
  });

  it('refuses recovery to an account without the badge', () => {
    ledger.use(stranger);
    const bare = `CALL_METHOD Address("${locker}") "recover" Address("${refuser.address}") Address("${token}") Decimal("1");
CALL_METHOD Address("${stranger.address}") "deposit_batch" Expression("ENTIRE_WORKTOP");`;
    expect(ledger.run(bare, stranger.address).committed).toBe(false);
  });

  it('lets only the recipient claim what was stored for them', () => {
    ledger.use(stranger);
    const theft = `CALL_METHOD Address("${locker}") "claim" Address("${refuser.address}") Address("${token}") Decimal("25");
CALL_METHOD Address("${stranger.address}") "deposit_batch" Expression("ENTIRE_WORKTOP");`;
    expect(ledger.run(theft, stranger.address).committed).toBe(false);

    ledger.use(refuser);
    const manifest = claimManifest({ account: refuser.address, locker, claims: [{ resource: token, amount: '20' }] });
    // The refuser blocks third-party deposits, yet their own claim lands.
    expectCommitted(ledger.run(manifest, refuser.address), manifest);
    expect(ledger.balance(refuser.address, token)).toBe('20');
  });

  it('claims from several lockers in one transaction', () => {
    ledger.use(sender);
    const create = createLockerManifest({ account: sender.address, allowRecover: true, lockerPackage });
    const run = ledger.run(create, sender.address);
    expectCommitted(run, create);
    const second = run.newEntities.find((a) => a.startsWith('locker_sim1'))!;
    const secondBadge = run.newEntities.find((a) => a.startsWith('resource_sim1'))!;
    for (const [target, proof] of [[locker, badge], [second, secondBadge]] as const) {
      const store = airdropManifest({
        account: sender.address,
        locker: target,
        badge: { account: sender.address, resource: proof },
        resource: token,
        claimants: [{ account: stranger.address, amount: '3' }],
        tryDirectSend: false,
      });
      expectCommitted(ledger.run(store, sender.address), store);
    }

    ledger.use(stranger);
    const before = Number(ledger.balance(stranger.address, token));
    const manifest = claimFromLockersManifest({
      account: stranger.address,
      lockers: [
        { locker, claims: [{ resource: token, amount: '3' }] },
        { locker: second, claims: [{ resource: token, amount: '3' }] },
        { locker: second, claims: [] },
      ],
    });
    expect(manifest.match(/deposit_batch/g)).toHaveLength(1);
    expectCommitted(ledger.run(manifest, stranger.address), manifest);
    expect(Number(ledger.balance(stranger.address, token))).toBe(before + 6);
  });

  it('lets the badge holder recover what is left', () => {
    ledger.use(sender);
    const before = Number(ledger.balance(sender.address, token));
    const manifest = recoverManifest({
      account: sender.address,
      locker,
      badge: { account: sender.address, resource: badge },
      claimant: refuser.address,
      resource: token,
      amount: '5',
    });
    expectCommitted(ledger.run(manifest, sender.address), manifest);
    expect(Number(ledger.balance(sender.address, token))).toBe(before + 5);
  });

  it('claims its own and recovers a recipient\'s in one transaction', () => {
    ledger.use(sender);
    const store = airdropManifest({
      account: sender.address,
      locker,
      badge: { account: sender.address, resource: badge },
      resource: token,
      claimants: [
        { account: sender.address, amount: '2' },
        { account: stranger.address, amount: '3' },
      ],
      tryDirectSend: false,
    });
    expectCommitted(ledger.run(store, sender.address), store);

    const before = Number(ledger.balance(sender.address, token));
    const proof = { account: sender.address, resource: badge };
    const manifest = withdrawManifest(sender.address, [
      { kind: 'claim', locker, claimant: sender.address, item: { resource: token, amount: '2' } },
      { kind: 'recover', locker, claimant: stranger.address, item: { resource: token, amount: '3' }, badge: proof },
    ]);
    expect(manifest.match(/create_proof/g)).toHaveLength(1);
    expectCommitted(ledger.run(manifest, sender.address), manifest);
    expect(Number(ledger.balance(sender.address, token))).toBe(before + 5);
  });

  it('recovers what several recipients never claimed, in one transaction', () => {
    ledger.use(sender);
    const store = airdropManifest({
      account: sender.address,
      locker,
      badge: { account: sender.address, resource: badge },
      resource: token,
      claimants: [
        { account: accepter.address, amount: '4' },
        { account: stranger.address, amount: '6' },
      ],
      tryDirectSend: false,
    });
    expectCommitted(ledger.run(store, sender.address), store);

    const before = Number(ledger.balance(sender.address, token));
    const manifest = recoverAllManifest({
      account: sender.address,
      locker,
      badge: { account: sender.address, resource: badge },
      items: [
        { claimant: accepter.address, claims: [{ resource: token, amount: '4' }] },
        { claimant: stranger.address, claims: [{ resource: token, amount: '6' }] },
      ],
    });
    expect(manifest.match(/create_proof/g)).toHaveLength(1);
    expect(manifest.match(/deposit_batch/g)).toHaveLength(1);
    expectCommitted(ledger.run(manifest, sender.address), manifest);
    expect(Number(ledger.balance(sender.address, token))).toBe(before + 10);
  });

  it('airdrops NFTs', () => {
    ledger.use(sender);
    const out = ledger.exec('new-simple-badge', '--name', 'Ticket');
    const nft = out.match(/NonFungibleGlobalId: (resource_sim1\w+):/)![1];
    const manifest = airdropManifest({
      account: sender.address,
      locker,
      badge: { account: sender.address, resource: badge },
      resource: nft,
      claimants: [{ account: refuser.address, nftIds: ['#1#'] }],
      tryDirectSend: true,
    });
    expectCommitted(ledger.run(manifest, sender.address), manifest);
    ledger.use(refuser);
    const claim = claimManifest({ account: refuser.address, locker, claims: [{ resource: nft, nftIds: ['#1#'] }] });
    expectCommitted(ledger.run(claim, refuser.address), claim);
    expect(ledger.show(refuser.address)).toContain(nft);
  });

  it('creates a locker and airdrops with it in one transaction', () => {
    ledger.use(sender);
    for (const allowRecover of [true, false]) {
      const manifest = createLockerAndAirdropManifest({
        account: sender.address,
        allowRecover,
        lockerPackage,
        resourcePackage,
        resource: token,
        claimants: [
          { account: accepter.address, amount: '3' },
          { account: refuser.address, amount: '4' },
        ],
        tryDirectSend: true,
      });
      const before = Number(ledger.balance(accepter.address, token));
      const run = ledger.run(manifest, sender.address);
      expectCommitted(run, manifest);
      const newLocker = run.newEntities.find((a) => a.startsWith('locker_sim1'))!;
      const newBadge = run.newEntities.find((a) => a.startsWith('resource_sim1'))!;
      expect(newLocker).toBeTruthy();
      // The badge ends in the sender's account, and the accepter got paid at once.
      expect(ledger.balance(sender.address, newBadge)).toBe('1');
      expect(Number(ledger.balance(accepter.address, token))).toBe(before + 3);

      // The refuser's share waits in the new locker, and recovery follows the choice.
      const recover = recoverManifest({
        account: sender.address,
        locker: newLocker,
        badge: { account: sender.address, resource: newBadge },
        claimant: refuser.address,
        resource: token,
        amount: '1',
      });
      expect(ledger.run(recover, sender.address).committed).toBe(allowRecover);
      ledger.use(refuser);
      const claim = claimManifest({ account: refuser.address, locker: newLocker, claims: [{ resource: token, amount: '3' }] });
      expectCommitted(ledger.run(claim, refuser.address), claim);
      ledger.use(sender);
    }
  });
});
