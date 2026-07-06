import { describe, it, expect } from 'vitest';
import {
  createNonFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
} from '@/features/console/lib/create-token-manifests';
import { initialMetadataEntry, MetadataType } from '@/features/console/lib/metadata-manifests';
import { staticallyValidateManifest } from '@/services/ret';

const ACCOUNT = 'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk';
// Well-known Stokenet faucet component.
const FAUCET = 'component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl';

describe('new MCP manifest builders produce RET-valid manifests', () => {
  it('NFT collection manifest is statically valid', async () => {
    const metadata = [
      initialMetadataEntry('name', 'My Collection', false),
      initialMetadataEntry('description', 'A test collection', false),
      initialMetadataEntry('icon_url', 'https://example.com/i.png', false, MetadataType.Url),
    ].join(`,
          `);

    const manifest = createNonFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'None',
      accountAddress: ACCOUNT,
      trackSupply: true,
      metadata,
      authRoles: { ...DEFAULT_AUTH_ROLES, minter: 'denyAll', burner: 'denyAll' },
      nfts: [
        { name: 'First', description: 'one', key_image_url: 'https://example.com/1.png', customData: {} },
        { name: 'Second', description: 'two', key_image_url: '', customData: {} },
      ],
      nftBaseFieldsLocked: { name: false, description: false, key_image_url: false },
      nftCustomFields: [],
    }).trim();

    const validation = await staticallyValidateManifest(manifest, 'stokenet');
    expect(validation.valid, validation.error).toBe(true);
  });

  it('faucet manifest is statically valid', async () => {
    const manifest = `CALL_METHOD
    Address("${FAUCET}")
    "free"
;
CALL_METHOD
    Address("${ACCOUNT}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;`;
    const validation = await staticallyValidateManifest(manifest, 'stokenet');
    expect(validation.valid, validation.error).toBe(true);
  });
});
