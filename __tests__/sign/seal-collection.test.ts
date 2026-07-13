// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ATTESTATION_FIELDS,
  buildCollectionCreateManifest,
  buildCollectionMintManifest,
  type AttestationData,
} from '@/features/sign/lib/seal-collection';
import { buildRadixSealDeployManifest } from '@/features/sign/lib/radix-seal-manifest';
import { RadixNetworkId } from '@/features/wallet/constants/network';

const ACCOUNT = 'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk';
const SEAL = 'resource_tdx_2_1n2sealsealsealsealsealsealsealsealsealsealsealsealseal';

const attestation: AttestationData = {
  docHash: 'ab'.repeat(32),
  timestamp: '2026-07-11T00:00:00.000Z',
  docName: 'contrato.pdf',
  signers: `${ACCOUNT},${ACCOUNT}`,
  network: 'stokenet',
  sealAddress: SEAL,
};

describe('collection create manifest', () => {
  it('creates a mintable, soulbound resource owned by the account signature, first id #1#', async () => {
    const manifest = await buildCollectionCreateManifest({
      account: ACCOUNT,
      curve: 'curve25519',
      networkId: RadixNetworkId.Stokenet,
      collectionName: 'My Attestations',
      imageUrl: 'https://example.test/seal.svg',
      sealAddress: SEAL,
      attestation,
    });

    expect(manifest).toContain('CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY');
    // First NFT id is #1#, not #0#.
    expect(manifest).toContain('NonFungibleLocalId("#1#")');
    expect(manifest).not.toContain('NonFungibleLocalId("#0#")');
    // Owner rule requires the account's virtual signature badge (global id).
    expect(manifest).toMatch(/NonFungibleGlobalId\("resource_tdx_2_1n[a-z0-9]*ed25sg[a-z0-9]*:\[[0-9a-f]{58}\]"\)/);
    // Discovery marker + seal pointer in resource metadata.
    expect(manifest).toContain('"radix_seal_collection"');
    expect(manifest).toContain('"radix_seal"');
    expect(manifest).toContain(SEAL);
    // Deposits the NFT into the signer's account.
    expect(manifest).toContain(`Address("${ACCOUNT}")`);
    expect(manifest).toContain('try_deposit_batch_or_abort');
  });

  it('omits the seal pointer when the brand is not yet deployed', async () => {
    const manifest = await buildCollectionCreateManifest({
      account: ACCOUNT,
      curve: 'curve25519',
      networkId: RadixNetworkId.Stokenet,
      collectionName: 'My Attestations',
      imageUrl: 'https://example.test/seal.svg',
      sealAddress: '',
      attestation: { ...attestation, sealAddress: '' },
    });
    expect(manifest).not.toContain('"radix_seal" =>');
  });
});

describe('collection mint manifest', () => {
  it('mints the next id into the existing resource with custom data in schema order', () => {
    const manifest = buildCollectionMintManifest({
      account: ACCOUNT,
      resourceAddress: 'resource_tdx_2_1thecollectionresourceaddressxxxxxxxxxxxxxxxxxxxxxx',
      nextId: 7,
      imageUrl: 'https://example.test/seal.svg',
      attestation,
    });
    expect(manifest).toContain('MINT_NON_FUNGIBLE');
    expect(manifest).toContain('NonFungibleLocalId("#7#")');
    expect(manifest).toContain('try_deposit_batch_or_abort');
    // Custom values are present and ordered like ATTESTATION_FIELDS
    // (docHash before signed_at before the seal pointer).
    const idx = (needle: string) => manifest.indexOf(needle);
    expect(idx(attestation.docHash)).toBeGreaterThan(-1);
    expect(idx(attestation.docHash)).toBeLessThan(idx(attestation.timestamp));
    expect(idx(attestation.timestamp)).toBeLessThan(idx(SEAL));
    expect(ATTESTATION_FIELDS.map((f) => f.key)).toContain('document_hash');
  });
});

describe('radix seal deploy manifest (v2, open mint)', () => {
  it('builds an open-mint soulbound RUID brand with locked metadata and no initial supply', () => {
    const manifest = buildRadixSealDeployManifest({
      imageUrl: 'https://example.test/seal/radix-seal.svg',
      origin: 'https://example.test',
      dAppDefinition: ACCOUNT,
    });
    expect(manifest).toContain('CREATE_NON_FUNGIBLE_RESOURCE');
    expect(manifest).not.toContain('WITH_INITIAL_SUPPLY');
    // RUID non-fungible id type → concurrent public mints cannot collide.
    expect(manifest).toContain('Enum<3u8>()');
    // Minter role is AllowAll with a DenyAll updater (open forever, locked).
    expect(manifest).toContain('Some(Enum<AccessRule::AllowAll>())');
    expect(manifest).toContain('"Radix Seal"');
    expect(manifest).toContain('"certificate-authority"');
    expect(manifest).toContain('dapp_definitions');
  });
});
