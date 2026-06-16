import { describe, it, expect } from 'vitest';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import {
  createFungibleTokenManifest,
  createNonFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
} from '@/features/console/lib/create-token-manifests';

const ACCOUNT = 'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw';

async function expectValidManifest(manifestStr: string) {
  try {
    const result = await RadixEngineToolkit.Instructions.staticallyValidate(
      { kind: 'String', value: manifestStr },
      1 // Mainnet network ID
    );
    if (result.kind === 'Invalid') {
      throw new Error((result as any).error);
    }
    expect(result.kind).toBe('Valid');
  } catch (error: any) {
    throw new Error(`Manifest validation failed: ${error.message}\nManifest:\n${manifestStr}`);
  }
}

describe('Manifest Simulation Validation', () => {
  it('validates a basic fungible token manifest', async () => {
    const manifest = createFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'Updatable',
      accountAddress: ACCOUNT,
      trackSupply: true,
      divisibility: '18',
      initialSupply: '1000',
      metadata: '',
      authRoles: DEFAULT_AUTH_ROLES,
    });
    await expectValidManifest(manifest);
  });

  it('validates a non-fungible token manifest with ALL fields unlocked', async () => {
    const manifest = createNonFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'Updatable',
      accountAddress: ACCOUNT,
      trackSupply: false,
      metadata: '',
      authRoles: DEFAULT_AUTH_ROLES,
      nftBaseFieldsLocked: { name: false, description: false, key_image_url: false },
      nftCustomFields: [
        { key: 'power', locked: false },
        { key: 'speed', locked: false },
      ],
      nfts: [
        { name: 'Hero 1', description: 'Desc 1', key_image_url: 'https://img.com/1', customData: { power: '100', speed: '50' } },
        { name: 'Hero 2', description: 'Desc 2', key_image_url: 'https://img.com/2', customData: { power: '80', speed: '90' } },
      ]
    });
    await expectValidManifest(manifest);
  });

  it('validates a non-fungible token manifest with MIXED locked and unlocked fields', async () => {
    const manifest = createNonFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'Updatable',
      accountAddress: ACCOUNT,
      trackSupply: true,
      metadata: '',
      authRoles: DEFAULT_AUTH_ROLES,
      nftBaseFieldsLocked: { name: true, description: false, key_image_url: true },
      nftCustomFields: [
        { key: 'power', locked: true },
        { key: 'speed', locked: false },
      ],
      nfts: [
        { name: 'Hero 1', description: 'Desc 1', key_image_url: 'https://img.com/1', customData: { power: '100', speed: '50' } },
      ]
    });
    await expectValidManifest(manifest);
  });

  it('validates a non-fungible token manifest with ALL fields locked', async () => {
    const manifest = createNonFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'Updatable',
      accountAddress: ACCOUNT,
      trackSupply: true,
      metadata: '',
      authRoles: DEFAULT_AUTH_ROLES,
      nftBaseFieldsLocked: { name: true, description: true, key_image_url: true },
      nftCustomFields: [
        { key: 'power', locked: true },
        { key: 'speed', locked: true },
      ],
      nfts: [
        { name: 'Hero 1', description: 'Desc 1', key_image_url: 'https://img.com/1', customData: { power: '100', speed: '50' } },
      ]
    });
    await expectValidManifest(manifest);
  });

  it('validates a non-fungible token manifest with empty custom fields (blank values)', async () => {
    const manifest = createNonFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'Updatable',
      accountAddress: ACCOUNT,
      trackSupply: true,
      metadata: '',
      authRoles: DEFAULT_AUTH_ROLES,
      nftBaseFieldsLocked: { name: false, description: false, key_image_url: false },
      nftCustomFields: [
        { key: 'element', locked: false },
      ],
      nfts: [
        { name: 'Hero 1', description: 'Desc 1', key_image_url: 'https://img.com/1', customData: { element: 'fire' } },
        { name: 'Hero 2', description: 'Desc 2', key_image_url: 'https://img.com/2', customData: { element: '' } },
      ]
    });
    await expectValidManifest(manifest);
  });
});
