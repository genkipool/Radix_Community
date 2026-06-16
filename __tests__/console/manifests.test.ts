import { describe, it, expect } from 'vitest';
import {
  accessRuleToManifestSyntax,
  authRolePairSyntax,
} from '@/features/console/lib/access-rules';
import {
  createFungibleTokenManifest,
  createNonFungibleTokenManifest,
  nftItemsToManifestSyntax,
  DEFAULT_AUTH_ROLES,
} from '@/features/console/lib/create-token-manifests';
import { buildBadgeProofManifest } from '@/features/console/lib/badge-proof-manifest';
import {
  blake2bHashHex,
  getDeployPackageManifest,
} from '@/features/console/lib/deploy-package-manifest';
import {
  initialMetadataEntry,
  initialMetadataArrayEntry,
  setStringMetadata,
  setOriginArrayMetadata,
  removeMetadata,
  typedMetadataToString,
  getMetadataString,
} from '@/features/console/lib/metadata-manifests';

const ACCOUNT = 'account_rdx1283u6e8r2jnz4a3jwv0hnrqfr8aq7kapg7q8h9d4f560g2f8wq7y4l';
const RESOURCE = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

describe('access rules', () => {
  it('maps none to None', () => {
    expect(accessRuleToManifestSyntax({ type: 'none' }, 'Updatable')).toBe('None');
  });

  it('encodes the updatable discriminator', () => {
    expect(accessRuleToManifestSyntax({ type: 'allowAll' }, 'None')).toContain('Enum<0u8>');
    expect(accessRuleToManifestSyntax({ type: 'allowAll' }, 'Fixed')).toContain('Enum<1u8>');
    expect(accessRuleToManifestSyntax({ type: 'allowAll' }, 'Updatable')).toContain('Enum<2u8>');
  });

  it('encodes fungible and non-fungible badge rules', () => {
    expect(accessRuleToManifestSyntax({ type: 'fungible', address: RESOURCE }, 'Updatable'))
      .toContain(`Address("${RESOURCE}")`);
    expect(
      accessRuleToManifestSyntax({ type: 'nonFungible', address: `${RESOURCE}:#1#` }, 'Updatable'),
    ).toContain(`NonFungibleGlobalId("${RESOURCE}:#1#")`);
  });

  it('builds auth role pairs', () => {
    const pair = authRolePairSyntax('allowAll', 'denyAll');
    expect(pair).toContain('Some(Enum<AccessRule::AllowAll>())');
    expect(pair).toContain('Some(Enum<AccessRule::DenyAll>())');
    expect(authRolePairSyntax('owner', 'owner')).toContain('None');
  });
});

describe('create token manifests', () => {
  it('builds a fungible creation manifest with deposit', () => {
    const manifest = createFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'Updatable',
      accountAddress: ACCOUNT,
      trackSupply: true,
      divisibility: '18',
      initialSupply: '1000',
      metadata: initialMetadataEntry('name', 'Test Token', false),
      authRoles: DEFAULT_AUTH_ROLES,
    });
    expect(manifest).toContain('CREATE_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY');
    expect(manifest).toContain('18u8');
    expect(manifest).toContain('Decimal("1000")');
    expect(manifest).toContain('"name" => Tuple(');
    expect(manifest).toContain(`Address("${ACCOUNT}")`);
    expect(manifest).toContain('"try_deposit_batch_or_abort"');
  });

  it('builds a non-fungible creation manifest with indexed local ids', () => {
    const manifest = createNonFungibleTokenManifest({
      ownerAccessRule: { type: 'allowAll' },
      ownerRoleUpdatable: 'Updatable',
      accountAddress: ACCOUNT,
      trackSupply: true,
      metadata: '',
      authRoles: DEFAULT_AUTH_ROLES,
      nfts: [
        { name: 'One', description: 'First', key_image_url: 'https://img/1.png', customData: {} },
        { name: 'Two', description: 'Second', key_image_url: 'https://img/2.png', customData: {} },
      ],
      nftBaseFieldsLocked: { name: false, description: false, key_image_url: false },
      nftCustomFields: [],
    });
    expect(manifest).toContain('CREATE_NON_FUNGIBLE_RESOURCE_WITH_INITIAL_SUPPLY');
    expect(manifest).toContain('NonFungibleLocalId("#0#")');
    expect(manifest).toContain('NonFungibleLocalId("#1#")');
    expect(manifest).toContain('"Two"');
  });

  it('escapes quotes in nft data', () => {
    const syntax = nftItemsToManifestSyntax([
      { name: 'Say "hi"', description: '', key_image_url: '', customData: {} },
    ], []);
    expect(syntax).toContain('Say \\"hi\\"');
  });
});

describe('badge proofs', () => {
  it('creates proof of amount for fungible badges', () => {
    const manifest = buildBadgeProofManifest([
      { accountAddress: ACCOUNT, resourceAddress: RESOURCE },
    ]);
    expect(manifest).toContain('"create_proof_of_amount"');
    expect(manifest).toContain('Decimal("1")');
  });

  it('creates proof of non-fungibles when an id is given', () => {
    const manifest = buildBadgeProofManifest([
      { accountAddress: ACCOUNT, resourceAddress: RESOURCE, nonFungibleId: '#7#' },
    ]);
    expect(manifest).toContain('"create_proof_of_non_fungibles"');
    expect(manifest).toContain('NonFungibleLocalId("#7#")');
  });
});

describe('deploy package manifest', () => {
  it('hashes hex payloads with blake2b-256', () => {
    expect(blake2bHashHex('abc')).toBe(
      '9ac3628f6c9087cc04c77a07a06dc41aa7aa8ff8439b43354754cb41d2803436',
    );
  });

  it('embeds the wasm blob hash and schema', () => {
    const manifest = getDeployPackageManifest('abc', 'Tuple()', { type: 'none' }, 'Updatable');
    expect(manifest).toContain('PUBLISH_PACKAGE_ADVANCED');
    expect(manifest).toContain('Blob("9ac3628f6c9087cc04c77a07a06dc41aa7aa8ff8439b43354754cb41d2803436")');
    expect(manifest).toContain('Tuple()');
  });
});

describe('metadata manifests', () => {
  it('builds SET_METADATA / REMOVE_METADATA instructions', () => {
    expect(setStringMetadata(ACCOUNT, 'name', 'My dApp')).toContain('SET_METADATA');
    expect(setStringMetadata(ACCOUNT, 'name', 'My dApp')).toContain('Enum<Metadata::String>("My dApp")');
    expect(setOriginArrayMetadata(ACCOUNT, 'claimed_websites', ['https://a.com']))
      .toContain('Enum<Metadata::OriginArray>');
    expect(removeMetadata(ACCOUNT, 'tags')).toContain('REMOVE_METADATA');
  });

  it('builds initial metadata entries with lock flags', () => {
    expect(initialMetadataEntry('name', 'X', true)).toContain('true');
    expect(initialMetadataArrayEntry('tags', ['a', 'b'], false)).toContain('Array<String>("a", "b")');
  });

  it('flattens gateway typed metadata to strings', () => {
    expect(typedMetadataToString({ type: 'String', value: 'hello' })).toBe('hello');
    expect(typedMetadataToString({ type: 'StringArray', values: ['a', 'b'] })).toBe('a, b');
    expect(typedMetadataToString(undefined)).toBe('');
    expect(
      getMetadataString(
        [{ key: 'symbol', value: { typed: { type: 'String', value: 'XRD' } } }],
        'symbol',
      ),
    ).toBe('XRD');
  });
});
