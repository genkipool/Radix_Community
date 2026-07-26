import { describe, it, expect } from 'vitest';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import {
  buildRadixSealDeployManifest,
  buildSealMintManifest,
} from '@/features/sign/lib/radix-seal-manifest';
import { SEAL_IMAGE_URL } from '@/features/sign/constants/seal';
import {
  buildCollectionMetadataManifest,
  buildSignCollectionCreateManifest,
  buildSignRequestManifest,
  buildSignatureMintManifest,
  requestKey,
} from '@/features/sign/lib/sign-request';

const INITIATOR =
  'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw';
const SIGNER_2 =
  'account_rdx1283533slsjtx5r5efdj8c9864vsrg3p3vrw9cr25qyq8f0adlvvuc7';
// Well-known mainnet non-fungible resources stand in for the deployed seal
// brand and the signing collection in static validation.
const SEAL_RESOURCE =
  'resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed25sg';
const COLLECTION =
  'resource_rdx1nfxxxxxxxxxxsecpsgxxxxxxxxx004638826440xxxxxxxxxsecpsg';
const SEAL_GID = `${SEAL_RESOURCE}:{1111111111111111-2222222222222222-3333333333333333-4444444444444444}`;

const DOC_HASH =
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

async function expectValidManifest(manifestStr: string) {
  const result = await RadixEngineToolkit.Instructions.staticallyValidate(
    { kind: 'String', value: manifestStr },
    1, // Mainnet
  );
  if (result.kind === 'Invalid') {
    const invalid = result as { kind: 'Invalid'; error: unknown };
    throw new Error(
      `Manifest validation failed: ${String(invalid.error)}\nManifest:\n${manifestStr}`,
    );
  }
  expect(result.kind).toBe('Valid');
}

describe('Radix Seal v2 brand manifests', () => {
  it('validates the open-mint soulbound brand deploy (RUID ids, no supply)', async () => {
    await expectValidManifest(
      buildRadixSealDeployManifest({
        imageUrl: 'https://app.example/seal/radix-seal.svg',
        origin: 'https://app.example',
        dAppDefinition: INITIATOR,
      }),
    );
  });

  it('validates a user self-minting their seal (MINT_RUID_NON_FUNGIBLE)', async () => {
    await expectValidManifest(
      buildSealMintManifest({
        account: SIGNER_2,
        sealResource: SEAL_RESOURCE,
        imageUrl: 'https://app.example/seal/radix-seal.svg',
      }),
    );
  });
});

describe('signing collection + request manifests', () => {
  it('validates creating an EMPTY collection owned by the seal NFT', async () => {
    const manifest = buildSignCollectionCreateManifest({
      account: INITIATOR,
      sealGlobalId: SEAL_GID,
      sealAddress: SEAL_RESOURCE,
      networkId: 1,
      collectionName: 'Acme signing collection',
      imageUrl: 'https://acme.example/logo.png',
      issuer: {
        orgName: 'Acme S.L.',
        orgWebsite: 'https://acme.example',
        orgLogoUrl: 'https://acme.example/logo.png',
      },
    });
    // Owner rule targets the SPECIFIC seal NFT (resource + RUID local id),
    // never "any holder of the seal resource".
    expect(manifest).toContain(`NonFungibleGlobalId("${SEAL_GID}")`);
    // Display metadata is editable by the owner (that exact seal) only, and
    // the setter rule itself can never be changed.
    expect(manifest).toContain('"metadata_setter" => None');
    expect(manifest).toContain(
      '"metadata_setter_updater" => Some(Enum<AccessRule::DenyAll>())',
    );
    expect(manifest).toContain(
      '"metadata_locker_updater" => Some(Enum<AccessRule::DenyAll>())',
    );
    await expectValidManifest(manifest);
  });

  it('validates creating a collection bundled with the first signature', async () => {
    await expectValidManifest(
      buildSignCollectionCreateManifest({
        account: SIGNER_2,
        sealGlobalId: SEAL_GID,
        sealAddress: SEAL_RESOURCE,
        networkId: 1,
        collectionName: 'My signing collection',
        imageUrl: '',
        firstSignature: {
          docHash: DOC_HASH,
          request: requestKey(COLLECTION, 7),
          signedAt: new Date().toISOString(),
        },
      }),
    );
  });

  it('validates minting + distributing invitations with the initiator signing too', async () => {
    await expectValidManifest(
      buildSignRequestManifest({
        account: INITIATOR,
        sealGlobalId: SEAL_GID,
        collection: COLLECTION,
        nextId: 7,
        docHash: DOC_HASH,
        networkId: 1,
        requiredSigners: [INITIATOR, SIGNER_2],
        alsoSign: true,
        imageUrl: 'https://acme.example/logo.png',
      }),
    );
  });

  it('validates minting invitations without the initiator signature', async () => {
    await expectValidManifest(
      buildSignRequestManifest({
        account: INITIATOR,
        sealGlobalId: SEAL_GID,
        collection: COLLECTION,
        nextId: 1,
        docHash: DOC_HASH,
        networkId: 1,
        requiredSigners: [SIGNER_2],
        alsoSign: false,
        imageUrl: '',
      }),
    );
  });

  it("validates a co-signer minting their signature into their own collection", async () => {
    await expectValidManifest(
      buildSignatureMintManifest({
        account: SIGNER_2,
        sealGlobalId: SEAL_GID,
        collection: COLLECTION,
        nextId: 3,
        docHash: DOC_HASH,
        networkId: 1,
        request: requestKey(COLLECTION, 7),
        imageUrl: '',
      }),
    );
  });
});

/**
 * The collection's display metadata is the only part of it that can ever
 * change, and only for the seal that owns it. Everything a signature proves was
 * locked at creation.
 */
describe('collection issuer identity', () => {
  const base = {
    account: INITIATOR,
    sealGlobalId: `${SEAL_RESOURCE}:{1111111111111111-2222222222222222-3333333333333333-4444444444444444}`,
    collection: COLLECTION,
  };

  it('validates an update of every editable field', async () => {
    const manifest = buildCollectionMetadataManifest({
      ...base,
      name: 'Notaría Pérez',
      symbol: 'NPZ',
      iconUrl: 'https://app.example/logo.png',
      orgName: 'Notaría Pérez S.L.',
      orgUrl: 'https://notaria.example',
    });
    await expectValidManifest(manifest);
    // Owner-gated: the seal proof has to come first or the SET_METADATA fails.
    expect(manifest.indexOf('create_proof_of_non_fungibles')).toBeLessThan(
      manifest.indexOf('SET_METADATA'),
    );
  });

  it('writes only the fields given, leaving the rest on-ledger untouched', async () => {
    const manifest = buildCollectionMetadataManifest({ ...base, orgName: 'Solo esto' });
    await expectValidManifest(manifest);
    expect(manifest).toContain('"org_name"');
    expect(manifest).not.toContain('"name"');
    expect(manifest).not.toContain('"icon_url"');
    expect(manifest.match(/SET_METADATA/g)).toHaveLength(1);
  });

  it('produces nothing when nothing changed', () => {
    expect(buildCollectionMetadataManifest(base)).toBe('');
  });

  it('never touches the keys that were locked at creation', async () => {
    const manifest = buildCollectionMetadataManifest({
      ...base,
      name: 'x',
      orgName: 'y',
      orgUrl: 'https://z.example',
      iconUrl: 'https://z.example/i.png',
      symbol: 'XYZ',
    });
    for (const locked of ['radix_sign_collection', 'radix_seal', 'issuer', 'description', 'tags']) {
      expect(manifest).not.toContain(`"${locked}"`);
    }
  });
});

/**
 * Invitations land in other people's wallets, so their image is the Radix Seal
 * insignia and stays that way: locking it is both the branding and the
 * guarantee that an issuer cannot restyle evidence after it was signed.
 */
describe('collection NFT images are sealed shut', () => {
  const manifest = buildSignCollectionCreateManifest({
    account: INITIATOR,
    sealGlobalId: `${SEAL_RESOURCE}:{1111111111111111-2222222222222222-3333333333333333-4444444444444444}`,
    sealAddress: SEAL_RESOURCE,
    networkId: 1,
    collectionName: 'Test',
    imageUrl: 'https://app.example/seal.svg',
  });

  it('declares no mutable NFT field at all', () => {
    // The schema's mutable-field list is the empty Array<String>() below it.
    expect(manifest).toContain('Array<String>()');
    expect(manifest).not.toContain('Array<String>("key_image_url")');
  });

  it('denies the data updater role, so nothing can rewrite a minted NFT', () => {
    const roles = manifest.slice(manifest.indexOf('Tuple(\n      Enum<0u8>'));
    expect(roles).not.toContain('"owner"');
  });

  /**
   * Every entry point — the collection tool, the sign/encrypt onboarding, and
   * the first signature that creates the collection on the fly — goes through
   * this one builder, so the rules cannot differ by where the user started.
   */
  it('applies the same rules however the collection was requested', () => {
    const asFirstSignature = buildSignCollectionCreateManifest({
      account: INITIATOR,
      sealGlobalId: `${SEAL_RESOURCE}:{1111111111111111-2222222222222222-3333333333333333-4444444444444444}`,
      sealAddress: SEAL_RESOURCE,
      networkId: 1,
      collectionName: 'Test',
      imageUrl: 'https://app.example/seal.svg',
      firstSignature: {
        docHash: 'a'.repeat(64),
        request: '',
        signedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(asFirstSignature).toContain('Array<String>()');
    expect(asFirstSignature).not.toContain('Array<String>("key_image_url")');
  });

  it('normalises the symbol the same way whatever the caller typed', () => {
    const messy = buildSignCollectionCreateManifest({
      account: INITIATOR,
      sealGlobalId: `${SEAL_RESOURCE}:{1111111111111111-2222222222222222-3333333333333333-4444444444444444}`,
      sealAddress: SEAL_RESOURCE,
      networkId: 1,
      collectionName: 'Test',
      symbol: 'my-symbol-is-far-too-long',
      imageUrl: 'https://app.example/seal.svg',
    });
    expect(messy).toContain('"MYSYM"');
  });
});

/**
 * The insignia's image is written once, at mint, and the brand's schema locks
 * it: a seal minted blank is blank for good. So the rule is the issuer's logo
 * when there is one, the Radix Seal image when there is not — never nothing.
 */
describe('seal insignia image', () => {
  const mint = (imageUrl?: string) =>
    buildSealMintManifest({ account: SIGNER_2, sealResource: SEAL_RESOURCE, imageUrl });

  it("uses the issuer's logo when one was given", async () => {
    const manifest = mint('https://acme.example/logo.png');
    await expectValidManifest(manifest);
    expect(manifest).toContain('"https://acme.example/logo.png"');
  });

  it('falls back to the Radix Seal image when the logo is empty', async () => {
    for (const empty of [undefined, '', '   ']) {
      const manifest = mint(empty);
      await expectValidManifest(manifest);
      expect(manifest).toContain(SEAL_IMAGE_URL);
      expect(manifest).not.toContain('""');
    }
  });
});
