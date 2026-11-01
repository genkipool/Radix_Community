// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { badgeProblems, isXrd, managerBadgeRisks, reserveRisks } from '@/features/console/lib/pool-safety';
import { createPoolManifest, isManifestAddress } from '@/features/console/lib/pool-manifests';
import { MANIFEST_TEMPLATES } from '@/features/console/lib/manifest-templates';

const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const BADGE = 'resource_rdx1t4dekrf58h0r28s3c93z92w3jt5ngx87jzd63mgc597zmf3534rxfv';
const ACCOUNT = 'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw';
const STOKENET_RESOURCE = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
const PACKAGES = {
  pool: 'package_rdx1pkgxxxxxxxxxplxxxxxxxxxxxxx020379220524xxxxxxxxxplxxxx',
  resource: 'package_rdx1pkgxxxxxxxxxresrcexxxxxxxxx000538436477xxxxxxxxxresrce',
};

const DENY = { type: 'DenyAll' };
const BADGE_RULE = {
  type: 'Protected',
  access_rule: { type: 'ProofRule', proof_rule: { type: 'Require', requirement: { type: 'Resource', resource: BADGE } } },
};

/** Gateway entity details of a resource, every role DenyAll unless overridden (as the Gateway shapes it). */
function resource(supply: string, roles: Record<string, unknown> = {}) {
  const names = ['minter', 'burner', 'freezer', 'recaller', 'withdrawer', 'depositor'];
  const all = names.flatMap((n) => [n, `${n}_updater`]);
  return {
    details: {
      type: 'FungibleResource',
      total_supply: supply,
      role_assignments: {
        owner: { rule: DENY, updater: 'None' },
        entries: all.map((name) => ({
          role_key: { module: 'Main', name },
          assignment: { resolution: 'Explicit', explicit_rule: roles[name] ?? (name.startsWith('withdrawer') || name.startsWith('depositor') ? { type: 'AllowAll' } : DENY) },
        })),
      },
    },
  };
}

const held = (amount: string) => ({ fungibles: [{ resourceAddress: BADGE, amount }], nonFungibles: [] });

describe('badgeProblems', () => {
  it('accepts a fixed-supply badge the account holds whole', () => {
    expect(badgeProblems({ resource: BADGE, details: resource('1'), ...held('1') })).toEqual([]);
  });

  it('refuses XRD outright', () => {
    expect(isXrd(XRD)).toBe(true);
    expect(badgeProblems({ resource: XRD, details: null, fungibles: [{ resourceAddress: XRD, amount: '1000' }], nonFungibles: [] })).toEqual(['xrd']);
  });

  it('refuses a badge the account does not hold', () => {
    expect(badgeProblems({ resource: BADGE, details: resource('1'), fungibles: [], nonFungibles: [] })).toContain('notHeld');
  });

  it('refuses a badge other accounts hold part of', () => {
    expect(badgeProblems({ resource: BADGE, details: resource('10'), ...held('9') })).toEqual(['sharedSupply']);
  });

  it('refuses a badge that can still be minted, now or after a role change', () => {
    expect(badgeProblems({ resource: BADGE, details: resource('1', { minter: BADGE_RULE }), ...held('1') })).toEqual(['mintable']);
    expect(badgeProblems({ resource: BADGE, details: resource('1', { minter_updater: BADGE_RULE }), ...held('1') })).toEqual(['mintable']);
  });

  it('counts the ids of a non-fungible badge against its supply', () => {
    const nf = (ids: string[]) => ({ fungibles: [], nonFungibles: [{ resourceAddress: BADGE, ids }] });
    expect(badgeProblems({ resource: BADGE, details: resource('2'), ...nf(['#1#', '#2#']) })).toEqual([]);
    expect(badgeProblems({ resource: BADGE, details: resource('3'), ...nf(['#1#', '#2#']) })).toEqual(['sharedSupply']);
  });

  it('treats unknown details as unsafe', () => {
    expect(badgeProblems({ resource: BADGE, details: null, ...held('1') })).toEqual(['sharedSupply', 'mintable']);
  });
});

describe('reserveRisks', () => {
  it('flags tokens whose issuer can recall or freeze them', () => {
    expect(reserveRisks(resource('100'))).toEqual([]);
    expect(reserveRisks(resource('100', { recaller: BADGE_RULE }))).toEqual(['recallable']);
    expect(reserveRisks(resource('100', { freezer_updater: BADGE_RULE }))).toEqual(['freezable']);
  });
});

describe('managerBadgeRisks', () => {
  it('flags XRD, a mintable badge and a supply above one', () => {
    expect(managerBadgeRisks(XRD, null, true)).toEqual([{ kind: 'xrd' }]);
    expect(managerBadgeRisks(BADGE, resource('1'), true)).toEqual([]);
    expect(managerBadgeRisks(BADGE, resource('5', { minter: BADGE_RULE }), true)).toEqual([
      { kind: 'mintable' },
      { kind: 'supply', supply: 5 },
    ]);
  });

  it('leaves a rule on one specific non-fungible alone', () => {
    expect(managerBadgeRisks(BADGE, resource('5', { minter: BADGE_RULE }), false)).toEqual([]);
  });
});

describe('createPoolManifest address checks', () => {
  const base = { account: ACCOUNT, kind: 'two' as const, manager: { mode: 'newBadge' as const, badgeName: 'M' }, packages: PACKAGES };

  it('rejects an address that would close the literal and add instructions', () => {
    const evil = `${BADGE}")\n;\nCALL_METHOD Address("${ACCOUNT}") "withdraw" Address("${XRD}") Decimal("1000");\n#("`;
    expect(isManifestAddress(evil, 'resource_')).toBe(false);
    expect(() => createPoolManifest({ ...base, resources: [XRD, evil] })).toThrow(/not a valid resource address/);
  });

  it('rejects a bad checksum, the wrong entity type and another network', () => {
    expect(() => createPoolManifest({ ...base, resources: [XRD, `${BADGE.slice(0, -1)}q`] })).toThrow(/not a valid/);
    expect(() => createPoolManifest({ ...base, resources: [XRD, ACCOUNT] })).toThrow(/not a valid resource/);
    expect(() => createPoolManifest({ ...base, resources: [XRD, STOKENET_RESOURCE] })).toThrow(/another network/);
    expect(() =>
      createPoolManifest({ ...base, resources: [XRD, BADGE], manager: { mode: 'existingBadge', resource: `${BADGE}"` } }),
    ).toThrow(/manager badge/);
  });

  it('still builds with valid addresses and with the template placeholder account', () => {
    expect(createPoolManifest({ ...base, resources: [XRD, BADGE] })).toContain('"instantiate"');
    expect(createPoolManifest({ ...base, account: '{account}', resources: [XRD, BADGE] })).toContain('Address("{account}")');
  });

  it('makes the create-pool template refuse an injected resource list', () => {
    const template = MANIFEST_TEMPLATES.find((t) => t.id === 'create-pool')!;
    const ctx = { xrdAddress: XRD, poolPackage: PACKAGES.pool, resourcePackage: PACKAGES.resource, validatorOwnerBadge: BADGE };
    expect(() =>
      template.build({ account: ACCOUNT, poolType: 'TwoResourcePool', resources: `${XRD}, ${BADGE}") ; CALL_METHOD` }, ctx),
    ).toThrow();
  });
});
