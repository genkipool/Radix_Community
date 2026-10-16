// @vitest-environment node
/**
 * Account deposit rules against a real Radix Engine ledger (resim): the
 * manifest commits, and the rules it writes really decide what a third party
 * can deposit (the owner's own deposits always land).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { depositSettingsManifest, type DepositSettings } from '@/features/console/lib/account-deposits';
import { RESIM, ResimLedger, SIM_XRD, expectCommitted, type ResimAccount } from '../helpers/resim';

const OPEN: DepositSettings = { defaultRule: 'Accept', preferences: {}, depositors: [] };

describe.skipIf(!RESIM)('account deposit rules on resim', () => {
  let ledger: ResimLedger;
  let owner: ResimAccount;
  let sender: ResimAccount;
  let token = '';
  let badge = '';

  beforeAll(() => {
    ledger = new ResimLedger();
    owner = ledger.newAccount();
    sender = ledger.newAccount();
    ledger.use(sender);
    token = ledger.newToken('1000', 'Gift');
    badge = ledger.newBadge('Depositor');
  });

  afterAll(() => ledger?.dispose());

  /** A third-party deposit from `sender`, optionally presenting the depositor badge. */
  const thirdPartyDeposit = (resource: string, withBadge = false) => {
    ledger.use(sender);
    const proof = withBadge
      ? `CALL_METHOD Address("${sender.address}") "create_proof_of_amount" Address("${badge}") Decimal("1");\n`
      : '';
    const manifest = `${proof}CALL_METHOD Address("${sender.address}") "withdraw" Address("${resource}") Decimal("1");
TAKE_ALL_FROM_WORKTOP Address("${resource}") Bucket("gift");
CALL_METHOD Address("${owner.address}") "try_deposit_or_abort" Bucket("gift") ${withBadge ? `Some(Enum<ResourceOrNonFungible::Resource>(Address("${badge}")))` : 'None'};`;
    return ledger.run(manifest, sender.address).committed;
  };

  const apply = (current: DepositSettings, next: DepositSettings) => {
    ledger.use(owner);
    const manifest = depositSettingsManifest(owner.address, current, next);
    expectCommitted(ledger.run(manifest, owner.address), manifest);
  };

  it('rejects third-party deposits, except the resources allowed and the authorised badge', () => {
    expect(thirdPartyDeposit(SIM_XRD)).toBe(true);

    const closed: DepositSettings = { defaultRule: 'Reject', preferences: { [token]: 'Allowed' }, depositors: [{ resource: badge }] };
    apply(OPEN, closed);
    expect(thirdPartyDeposit(SIM_XRD)).toBe(false);
    expect(thirdPartyDeposit(token)).toBe(true);
    expect(thirdPartyDeposit(SIM_XRD, true)).toBe(true);

    // Back to open: the exception and the depositor are removed in the same transaction.
    apply(closed, OPEN);
    expect(thirdPartyDeposit(SIM_XRD)).toBe(true);
  });

  it('writes nothing when nothing changed', () => {
    expect(depositSettingsManifest(owner.address, OPEN, { ...OPEN })).toBe('');
  });
});
