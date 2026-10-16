// @vitest-environment node
/**
 * The manifest builder's deposit-rule and locker templates and blocks,
 * committed on a real Radix Engine ledger (resim).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { airdropManifest, createLockerManifest } from '@/features/console/lib/locker-manifests';
import { buildManifestFromBlocks, createBlock, type BlockType } from '@/features/console/lib/manifest-blocks';
import { MANIFEST_TEMPLATES } from '@/features/console/lib/manifest-templates';
import { RESIM, ResimLedger, SIM_XRD, expectCommitted, simulatorPackages, type ResimAccount } from '../helpers/resim';

const template = (id: string) => MANIFEST_TEMPLATES.find((t) => t.id === id)!;
const CTX = { xrdAddress: SIM_XRD, poolPackage: '', resourcePackage: '', validatorOwnerBadge: '' };

/** A manifest of blocks, each given as its type and field values. */
const blocks = (...items: Array<[BlockType, Record<string, string>]>) =>
  buildManifestFromBlocks(
    items.map(([type, values]) => {
      const block = createBlock(type);
      return { ...block, values: { ...block.values, ...values } };
    }),
  );

describe.skipIf(!RESIM)('builder deposit rules and locker on resim', () => {
  let ledger: ResimLedger;
  let owner: ResimAccount;
  let recipient: ResimAccount;
  let token = '';
  let depositorBadge = '';
  let locker = '';
  let lockerBadge = '';

  const commit = (who: ResimAccount, manifest: string) => {
    ledger.use(who);
    expectCommitted(ledger.run(manifest, who.address), manifest);
  };

  /** Stores `amount` of the token for the recipient, never delivering it directly. */
  const store = (amount: string) =>
    commit(
      owner,
      airdropManifest({
        account: owner.address,
        locker,
        badge: { account: owner.address, resource: lockerBadge },
        resource: token,
        claimants: [{ account: recipient.address, amount }],
        tryDirectSend: false,
      }),
    );

  beforeAll(async () => {
    const { locker: lockerPackage } = await simulatorPackages();
    ledger = new ResimLedger();
    owner = ledger.newAccount();
    recipient = ledger.newAccount();
    ledger.use(owner);
    token = ledger.newToken('1000', 'Drop');
    depositorBadge = ledger.newBadge('Depositor');
    const create = createLockerManifest({ account: owner.address, allowRecover: true, lockerPackage });
    const run = ledger.run(create, owner.address);
    expectCommitted(run, create);
    locker = run.newEntities.find((a) => a.startsWith('locker_sim1'))!;
    lockerBadge = run.newEntities.find((a) => a.startsWith('resource_sim1'))!;
  });

  afterAll(() => ledger?.dispose());

  it('commits every deposit-rule template', () => {
    const account = recipient.address;
    for (const [id, values] of [
      ['deposit-rule', { account, rule: 'AllowExisting' }],
      ['resource-preference', { account, resource: token, preference: 'Disallowed' }],
      ['resource-preference', { account, resource: token, preference: 'Remove' }],
      ['authorized-depositor', { account, action: 'add', badge: depositorBadge }],
      ['authorized-depositor', { account, action: 'remove', badge: depositorBadge }],
      ['deposit-rule', { account, rule: 'Accept' }],
    ] as const) {
      commit(recipient, template(id).build(values, CTX));
    }
  });

  it('commits every deposit-rule block in one manifest', () => {
    const account = recipient.address;
    const { manifest, incompleteIds } = blocks(
      ['setDefaultDepositRule', { account, rule: 'Reject' }],
      ['setResourcePreference', { account, resource: token, preference: 'Allowed' }],
      ['addAuthorizedDepositor', { account, badge: depositorBadge }],
      ['removeAuthorizedDepositor', { account, badge: depositorBadge }],
      ['removeResourcePreference', { account, resource: token }],
      ['setDefaultDepositRule', { account, rule: 'Accept' }],
    );
    expect(incompleteIds).toEqual([]);
    commit(recipient, manifest);
  });

  it('claims and recovers with the locker templates', () => {
    store('10');
    commit(recipient, template('locker-claim').build({ account: recipient.address, locker, resource: token, amount: '4' }, CTX));
    expect(ledger.balance(recipient.address, token)).toBe('4');

    const before = Number(ledger.balance(owner.address, token));
    commit(
      owner,
      template('locker-recover').build(
        { account: owner.address, locker, recovererBadge: lockerBadge, claimant: recipient.address, resource: token, amount: '6' },
        CTX,
      ),
    );
    expect(Number(ledger.balance(owner.address, token))).toBe(before + 6);
  });

  it('claims and recovers with the locker blocks', () => {
    store('10');
    const claim = blocks(
      ['lockerClaim', { locker, account: recipient.address, resource: token, amount: '3' }],
      ['depositAll', { account: recipient.address }],
    );
    commit(recipient, claim.manifest);
    expect(ledger.balance(recipient.address, token)).toBe('7');

    const before = Number(ledger.balance(owner.address, token));
    const recover = blocks(
      ['proof', { account: owner.address, resource: lockerBadge }],
      ['lockerRecover', { locker, claimant: recipient.address, resource: token, amount: '7' }],
      ['depositAll', { account: owner.address }],
    );
    commit(owner, recover.manifest);
    expect(Number(ledger.balance(owner.address, token))).toBe(before + 7);
  });
});
