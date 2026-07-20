import { describe, it, expect } from 'vitest';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import {
  buildRadixSealDeployManifest,
  buildSealMintManifest,
} from '@/features/sign/lib/radix-seal-manifest';
import {
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
