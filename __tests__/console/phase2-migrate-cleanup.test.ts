import { describe, expect, it, vi } from 'vitest';
import {
  buildMigrateBatches,
  buildMigrateItems,
  computeSendableXrd,
  isCriticalSystemBadge,
} from '@/features/console/lib/account-migrate';
import {
  buildCleanupBatches,
  inspectCleanupItems,
} from '@/features/console/lib/account-cleanup';
import type { GatewayPost } from '@/features/console/lib/resource-holders';

const FROM = 'account_tdx_2_1fromxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const TO = 'account_tdx_2_1toxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const XRD = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
const SPAM = 'resource_tdx_2_1spamxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const OWNER_BADGE = 'resource_tdx_2_1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxx50v974';

describe('account-migrate pure engine', () => {
  it('classifies XRD, fungibles, NFTs, and critical system badges accurately', () => {
    const items = buildMigrateItems({
      fungibles: [
        { resourceAddress: XRD, name: 'Radix', symbol: 'XRD', amount: '100' },
        { resourceAddress: SPAM, name: 'TokenA', symbol: 'TKA', amount: '50' },
      ],
      nonFungibles: [
        { resourceAddress: OWNER_BADGE, name: 'Validator Owner', ids: ['[abcd]'] },
      ],
    });
    expect(items.find((i) => i.resourceAddress === XRD)?.kind).toBe('xrd');
    expect(items.find((i) => i.resourceAddress === SPAM)?.kind).toBe('fungible');
    expect(items.find((i) => i.resourceAddress === OWNER_BADGE)?.isCriticalBadge).toBe(true);
    expect(isCriticalSystemBadge(OWNER_BADGE)).toBe(true);
  });

  it('computes exact sendable XRD minus fee reserve and places XRD last', () => {
    expect(computeSendableXrd('10.5', '2')).toBe('8.5');
    expect(computeSendableXrd('1.5', '2')).toBe('0');

    const items = buildMigrateItems({
      fungibles: [
        { resourceAddress: XRD, name: 'Radix', symbol: 'XRD', amount: '10' },
        { resourceAddress: SPAM, name: 'TokenA', symbol: 'TKA', amount: '50' },
      ],
      nonFungibles: [],
    });
    const batches = buildMigrateBatches(FROM, TO, items, '2');
    expect(batches).toHaveLength(1);
    const m = batches[0].manifest;
    expect(m.indexOf(SPAM)).toBeLessThan(m.indexOf(XRD));
    expect(m).toContain('Decimal("8")');
    expect(m).toContain('try_deposit_batch_or_abort');
  });
});

describe('account-cleanup pure engine', () => {
  it('detects burnability and protects XRD & owner badges', async () => {
    const post = vi.fn(async () => ({
      items: [
        { address: XRD, metadata: { items: [] }, details: { role_assignments: { entries: [] } } },
        {
          address: SPAM,
          metadata: { items: [] },
          details: { role_assignments: { entries: [{ role_key: { name: 'burner' }, assignment: { explicit_rule: { type: 'AllowAll' } } }] } },
        },
        { address: OWNER_BADGE, metadata: { items: [] }, details: { role_assignments: { entries: [] } } },
      ],
    }));

    const inspected = await inspectCleanupItems(post as unknown as GatewayPost, {
      fungibles: [
        { resourceAddress: XRD, name: 'XRD', symbol: 'XRD', amount: '100' },
        { resourceAddress: SPAM, name: 'Spam', symbol: 'SPM', amount: '999' },
      ],
      nonFungibles: [{ resourceAddress: OWNER_BADGE, name: 'Owner', ids: ['#1#'] }],
    });

    expect(inspected.find((i) => i.resourceAddress === XRD)?.protected).toBe(true);
    expect(inspected.find((i) => i.resourceAddress === OWNER_BADGE)?.protected).toBe(true);
    expect(inspected.find((i) => i.resourceAddress === SPAM)?.burnable).toBe(true);
    expect(inspected.find((i) => i.resourceAddress === SPAM)?.protected).toBe(false);
  });

  it('builds combined burn + Disallowed deposit preference manifest', () => {
    const batches = buildCleanupBatches({
      account: FROM,
      items: [{
        resourceAddress: SPAM,
        isNonFungible: false,
        name: 'Spam',
        amount: '999',
        burnable: true,
        protected: false,
      }],
      denyDeposits: true,
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].manifest).toContain('BURN_RESOURCE');
    expect(batches[0].manifest).toContain('set_resource_preference');
    expect(batches[0].manifest).toContain('Enum<ResourcePreference::Disallowed>()');
  });
});
