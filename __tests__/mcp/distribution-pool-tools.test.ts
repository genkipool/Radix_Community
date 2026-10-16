import { describe, expect, it } from 'vitest';

import { getMcpRegistry } from '@/services/mcp/tools';
import { generateSkillMarkdown } from '@/services/mcp/skills';
import { createPoolManifest, contributeManifest } from '@/features/console/lib/pool-manifests';
import { airdropManifest, claimManifest, createLockerManifest } from '@/features/console/lib/locker-manifests';
import { staticallyValidateManifest } from '@/services/ret';

/* Real Stokenet entities, so the toolkit checks addresses as well as syntax. */
const ACCOUNT = 'account_tdx_2_12yg4284tjs26tdf57wvfjmqara4fjgnrxk34dg59kk4xtkh66xq74l';
const OTHER = 'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk';
const XRD = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
const LSU = 'resource_tdx_2_1t45l9ku3r5mwxazht2qutmhhk3660hqqvxkkyl8rxs20n9k2zv0w7t';
const POOL_PACKAGE = 'package_tdx_2_1pkgxxxxxxxxxplxxxxxxxxxxxxx020379220524xxxxxxxxxe4r780';
const RESOURCE_PACKAGE = 'package_tdx_2_1pkgxxxxxxxxxresrcexxxxxxxxx000538436477xxxxxxxxxmn4mes';
const LOCKER_PACKAGE = 'package_tdx_2_1pkgxxxxxxxxxlckerxxxxxxxxxx000208064247xxxxxxxxx8jnpz0';

const valid = async (manifest: string) => {
  const result = await staticallyValidateManifest(manifest, 'stokenet');
  if (!result.valid) throw new Error(`${result.error}\n${manifest}`);
};

describe('pool and distribution MCP tools', () => {
  const names = getMcpRegistry().list().map((t) => t.name);

  it('registers every tool the console section offers', () => {
    for (const name of [
      'get_pool_state',
      'build_pool_manifest',
      'get_resource_holders',
      'plan_holder_distribution',
      'build_bulk_send_manifests',
      'get_locker_claims',
      'build_locker_manifest',
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it('documents the pool security rule and the locker workflow in the skill', () => {
    const markdown = generateSkillMarkdown('https://example.test');
    expect(markdown).toContain('### `build_pool_manifest`');
    expect(markdown).toContain('never create a pool whose manager is AllowAll');
    expect(markdown).toContain('### `build_locker_manifest`');
    expect(markdown).toContain('256 events');
    expect(markdown).not.toContain('{DEFAULT_BATCH_SIZE}');
  });
});

describe('pool and locker manifests are valid to the Radix Engine Toolkit', () => {
  it('create pool with a new badge, and with an existing one', async () => {
    const packages = { pool: POOL_PACKAGE, resource: RESOURCE_PACKAGE };
    await valid(
      createPoolManifest({ account: ACCOUNT, kind: 'two', resources: [XRD, LSU], manager: { mode: 'newBadge', badgeName: 'Pool manager' }, packages }),
    );
    await valid(
      createPoolManifest({ account: ACCOUNT, kind: 'multi', resources: [XRD, LSU], manager: { mode: 'existingBadge', resource: LSU }, packages }),
    );
  });

  it('contribute with the manager badge proof', async () => {
    const manifest = contributeManifest({
      account: ACCOUNT,
      pool: 'pool_tdx_2_1cs52z99qr8z2zu30lezc5yqjktcr250wnrh3y4t6xktzzcrsq4jfvk',
      kind: 'two',
      contributions: [
        { resource: XRD, amount: '10' },
        { resource: LSU, amount: '1' },
      ],
      manager: { account: ACCOUNT, resource: LSU },
    });
    expect(manifest.indexOf('create_proof_of_amount')).toBeLessThan(manifest.indexOf('"contribute"'));
  });

  it('create locker, airdrop and claim', async () => {
    await valid(createLockerManifest({ account: ACCOUNT, allowRecover: true, lockerPackage: LOCKER_PACKAGE }));
    // A well-formed Stokenet locker address (re-encoded from a resim one).
    const locker = 'locker_tdx_2_1dz68c34h0wkdw2nacz7pvc99e79upggk9uslsl0pv0p8kajg8c8w8s';
    await valid(
      airdropManifest({
        account: ACCOUNT,
        locker,
        badge: { account: ACCOUNT, resource: LSU },
        resource: XRD,
        claimants: [
          { account: OTHER, amount: '1.5' },
          { account: ACCOUNT, amount: '2' },
        ],
        tryDirectSend: true,
      }),
    );
    await valid(claimManifest({ account: OTHER, locker, claims: [{ resource: XRD, amount: '1.5' }] }));
  });
});
