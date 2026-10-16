// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import { MANIFEST_TEMPLATES } from '@/features/console/lib/manifest-templates';

const ACCOUNT = 'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const BADGE = 'resource_rdx1t4dekrf58h0r28s3c93z92w3jt5ngx87jzd63mgc597zmf3534rxfv';
// The entity type lives in the address bytes, and the toolkit checks the call
// against it: this one is a OneResourcePool.
const POOL = 'pool_rdx1c325zs6dz3un8ykkjavy9fkvvyzarkaehgsl408qup6f95aup3le3w';
const CTX = {
  xrdAddress: XRD,
  poolPackage: 'package_rdx1pkgxxxxxxxxxplxxxxxxxxxxxxx020379220524xxxxxxxxxplxxxx',
  resourcePackage: 'package_rdx1pkgxxxxxxxxxresrcexxxxxxxxx000538436477xxxxxxxxxresrce',
  validatorOwnerBadge: 'resource_rdx1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxvdrwnr',
};

const template = (id: string) => MANIFEST_TEMPLATES.find((t) => t.id === id)!;

async function expectValid(manifest: string) {
  const result = await RadixEngineToolkit.Instructions.staticallyValidate({ kind: 'String', value: manifest }, 1);
  if (result.kind !== 'Valid') throw new Error(`${JSON.stringify(result)}\n${manifest}`);
}

describe('pool templates', () => {
  it('never emit an AllowAll manager or owner', () => {
    for (const badge of ['', BADGE]) {
      const manifest = template('create-pool').build(
        { account: ACCOUNT, poolType: 'TwoResourcePool', resources: `${XRD}, ${BADGE}`, managerBadge: badge },
        CTX,
      );
      // AllowAll is Enum<0u8>() as a whole rule; the pool rules must be Protected (2u8).
      expect(manifest).not.toMatch(/"instantiate"\s+Enum<\w+(::\w+)?>\(\s*Enum<0u8>\(\)/);
      expect(manifest).toContain('Enum<2u8>(Enum<0u8>(Enum<0u8>(Enum<1u8>(');
    }
  });

  it('build statically valid manifests', async () => {
    await expectValid(
      template('create-pool').build({ account: ACCOUNT, poolType: 'TwoResourcePool', resources: `${XRD}, ${BADGE}` }, CTX),
    );
    await expectValid(
      template('create-pool').build(
        { account: ACCOUNT, poolType: 'MultiResourcePool', resources: `${XRD}, ${BADGE}`, managerBadge: BADGE },
        CTX,
      ),
    );
    await expectValid(
      template('contribute-pool').build(
        {
          account: ACCOUNT,
          pool: POOL,
          poolType: 'OneResourcePool',
          managerBadge: BADGE,
          resource1: XRD,
          amount1: '10',
        },
        CTX,
      ),
    );
    await expectValid(
      template('redeem-pool').build({ account: ACCOUNT, pool: POOL, poolUnit: BADGE, amount: '1' }, CTX),
    );
  });

  it('contribute presents the manager badge before touching the pool', () => {
    const manifest = template('contribute-pool').build(
      { account: ACCOUNT, pool: POOL, poolType: 'OneResourcePool', managerBadge: BADGE, resource1: XRD, amount1: '1' },
      CTX,
    );
    expect(manifest.indexOf('create_proof_of_amount')).toBeLessThan(manifest.indexOf('"contribute"'));
  });
});
