import { describe, expect, it } from 'vitest';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import {
  buildSignCollectionCreateManifest,
  isReservedCollectionMetadataKey,
  MAX_COLLECTION_META_FIELDS,
} from '@/features/sign/lib/sign-request';

const ACCOUNT =
  'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw';
const SEAL_RESOURCE =
  'resource_rdx1nfxxxxxxxxxxed25sgxxxxxxxxx002236757237xxxxxxxxxed25sg';
const SEAL_GID = `${SEAL_RESOURCE}:{1111111111111111-2222222222222222-3333333333333333-4444444444444444}`;

function build(extraMetadata: Array<{ key: string; value: string; locked: boolean }>) {
  return buildSignCollectionCreateManifest({
    account: ACCOUNT,
    sealGlobalId: SEAL_GID,
    sealAddress: SEAL_RESOURCE,
    networkId: 1,
    collectionName: 'Legal',
    imageUrl: 'https://example.org/seal.svg',
    extraMetadata,
  });
}

async function expectValid(manifest: string) {
  const result = await RadixEngineToolkit.Instructions.staticallyValidate(
    { kind: 'String', value: manifest },
    1,
  );
  expect(result.kind).toBe('Valid');
}

describe('custom collection metadata', () => {
  it('writes the entries the creator supplied', async () => {
    const manifest = build([
      { key: 'department', value: 'Legal', locked: false },
      { key: 'registry_no', value: 'B-88213', locked: true },
    ]);
    expect(manifest).toContain('"department"');
    expect(manifest).toContain('"Legal"');
    expect(manifest).toContain('"registry_no"');
    expect(manifest).toContain('"B-88213"');
    await expectValid(manifest);
  });

  it('honours the lock flag per entry', () => {
    const manifest = build([
      { key: 'open_field', value: 'edit me', locked: false },
      { key: 'sealed_field', value: 'forever', locked: true },
    ]);
    // `initialMetadataEntry` emits the lock as the tuple's trailing boolean.
    expect(manifest).toMatch(/"open_field"[\s\S]{0,200}?false/);
    expect(manifest).toMatch(/"sealed_field"[\s\S]{0,200}?true/);
  });

  it('refuses the keys the standard writes itself', () => {
    // A duplicate key would make the whole transaction fail, and these three
    // in particular are what verification reads to trust a collection.
    const manifest = build([
      { key: 'radix_sign_collection', value: 'v99', locked: false },
      { key: 'radix_seal', value: 'resource_rdx1_fake', locked: false },
      { key: 'issuer', value: 'somebody else', locked: false },
      { key: 'NAME', value: 'override attempt', locked: false },
      { key: 'org_name', value: 'override attempt', locked: false },
    ]);
    expect(manifest).not.toContain('v99');
    expect(manifest).not.toContain('resource_rdx1_fake');
    expect(manifest).not.toContain('somebody else');
    expect(manifest).not.toContain('override attempt');
    // The real marker is still there, exactly once.
    expect(manifest.match(/"radix_sign_collection"/g)).toHaveLength(1);
  });

  it('keeps the marker and the seal reference intact alongside custom keys', async () => {
    const manifest = build([{ key: 'policy_url', value: 'https://x.org/p', locked: true }]);
    expect(manifest.match(/"radix_sign_collection"/g)).toHaveLength(1);
    expect(manifest).toContain(SEAL_RESOURCE);
    await expectValid(manifest);
  });

  it('drops blanks and repeated keys instead of emitting a broken manifest', async () => {
    const manifest = build([
      { key: '  ', value: 'no key', locked: false },
      { key: 'team', value: '   ', locked: false },
      { key: 'team', value: 'first', locked: false },
      { key: 'TEAM', value: 'second', locked: false },
    ]);
    expect(manifest).not.toContain('no key');
    expect(manifest).toContain('"first"');
    expect(manifest).not.toContain('"second"');
    await expectValid(manifest);
  });

  it('caps how many entries one collection may declare', () => {
    const many = Array.from({ length: MAX_COLLECTION_META_FIELDS + 5 }, (_, i) => ({
      key: `field_${i}`,
      value: `value_${i}`,
      locked: false,
    }));
    const manifest = build(many);
    expect(manifest).toContain('"field_0"');
    expect(manifest).toContain(`"field_${MAX_COLLECTION_META_FIELDS - 1}"`);
    expect(manifest).not.toContain(`"field_${MAX_COLLECTION_META_FIELDS}"`);
  });

  it('still builds the standard collection when nothing custom is given', async () => {
    await expectValid(build([]));
    await expectValid(
      buildSignCollectionCreateManifest({
        account: ACCOUNT,
        sealGlobalId: SEAL_GID,
        sealAddress: SEAL_RESOURCE,
        networkId: 1,
        collectionName: '',
        imageUrl: 'https://example.org/seal.svg',
      }),
    );
  });

  it('reports reserved keys case-insensitively, for the form to warn early', () => {
    expect(isReservedCollectionMetadataKey('icon_url')).toBe(true);
    expect(isReservedCollectionMetadataKey('  Radix_Seal  ')).toBe(true);
    expect(isReservedCollectionMetadataKey('department')).toBe(false);
  });
});
