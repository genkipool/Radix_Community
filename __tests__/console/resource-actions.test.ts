import { describe, it, expect } from 'vitest';
import {
  accessRuleSyntax,
  burnManifest,
  burnNonFungibleManifest,
  freezeVaultManifest,
  lockMetadataManifest,
  mintFungibleManifest,
  mintNonFungibleForIdType,
  mintNonFungibleManifest,
  mintRuidNonFungibleManifest,
  formatNonFungibleLocalId,
  isValidNonFungibleLocalId,
  suggestNonFungibleLocalId,
  isEditableNftFieldKind,
  nftFieldLiteral,
  nftFieldPlaceholder,
  updateNonFungibleDataManifest,
  toNonFungibleIdKind,
  nonFungibleIdKindLabel,
  recallManifest,
  setOwnerRoleManifest,
} from '@/features/console/lib/resource-actions';

const RES = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
const ACC = 'account_tdx_2_169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ccn09n5';
const VAULT = 'internal_vault_tdx_2_1tz9uaalv8g3ahmwep2trlyj2m3zn7rstm9pwessa3k56me2fuywfep';

// Manifest shapes were validated against RET staticallyValidate during development.
describe('resource action manifests', () => {
  it('mints fungibles and NFTs', () => {
    expect(mintFungibleManifest(RES, '100')).toContain('MINT_FUNGIBLE');
    const nft = mintNonFungibleManifest(RES, {
      id: '#7#',
      name: 'My "NFT"',
      description: 'desc',
      keyImageUrl: 'https://img',
    });
    expect(nft).toContain('MINT_NON_FUNGIBLE');
    expect(nft).toContain('NonFungibleLocalId("#7#")');
    expect(nft).toContain('My \\"NFT\\"');
  });

  it('burns via withdraw + bucket', () => {
    const manifest = burnManifest(ACC, RES, '5');
    expect(manifest).toContain('"withdraw"');
    expect(manifest).toContain('BURN_RESOURCE');
    expect(manifest).toContain('Bucket("bucket1")');
  });

  it('burns multiple NFTs in a single manifest', () => {
    const manifest = burnNonFungibleManifest(ACC, RES, ['#1#', '#2#', '#3#']);
    expect(manifest).toContain('"withdraw_non_fungibles"');
    expect(manifest).toContain('NonFungibleLocalId("#1#")');
    expect(manifest).toContain('NonFungibleLocalId("#2#")');
    expect(manifest).toContain('NonFungibleLocalId("#3#")');
    expect(manifest).toContain('BURN_RESOURCE');
  });

  it('burns a single NFT via array', () => {
    const manifest = burnNonFungibleManifest(ACC, RES, ['#7#']);
    expect(manifest).toContain('NonFungibleLocalId("#7#")');
    expect(manifest).toContain('BURN_RESOURCE');
    // Should only contain one NonFungibleLocalId(...)  call (not the Array type)
    const matches = manifest.match(/NonFungibleLocalId\(/g);
    expect(matches).toHaveLength(1);
  });

  it('locks metadata keys', () => {
    expect(lockMetadataManifest(RES, 'name')).toContain('LOCK_METADATA');
  });

  it('builds owner-role access rules', () => {
    expect(accessRuleSyntax({ kind: 'allowAll' })).toBe('Enum<AccessRule::AllowAll>()');
    expect(accessRuleSyntax({ kind: 'denyAll' })).toBe('Enum<AccessRule::DenyAll>()');
    const badge = setOwnerRoleManifest(RES, { kind: 'badge', resourceAddress: RES });
    expect(badge).toContain('SET_OWNER_ROLE');
    expect(badge).toContain('Enum<AccessRule::Protected>');
    expect(badge).toContain(`Address("${RES}")`);
  });

  it('recalls and freezes vaults with flags', () => {
    expect(recallManifest(VAULT, '3')).toContain('RECALL_FROM_VAULT');
    expect(freezeVaultManifest(VAULT, 'all', true)).toContain('FREEZE_VAULT');
    expect(freezeVaultManifest(VAULT, 'all', true)).toContain('Tuple(7u32)');
    expect(freezeVaultManifest(VAULT, 'withdraw', false)).toContain('UNFREEZE_VAULT');
    expect(freezeVaultManifest(VAULT, 'withdraw', false)).toContain('Tuple(1u32)');
  });
});

/**
 * The local-id type is fixed when a collection is created and the engine
 * rejects any mint that uses another one with
 * NonFungibleResourceManagerError(InvalidNonFungibleIdType). Minting always
 * assumed integer ids, so every String, Bytes or RUID collection failed — the
 * Radix Seal brand (RUID) among them.
 */
describe('non-fungible local id types', () => {
  it('wraps a bare value in the syntax of its type', () => {
    expect(formatNonFungibleLocalId('Integer', '12')).toBe('#12#');
    expect(formatNonFungibleLocalId('String', 'invoice_2026')).toBe('<invoice_2026>');
    expect(formatNonFungibleLocalId('Bytes', 'c0ffee')).toBe('[c0ffee]');
    expect(formatNonFungibleLocalId('Integer', '')).toBe('');
  });

  it('leaves an already well-formed id untouched', () => {
    expect(formatNonFungibleLocalId('Integer', '#12#')).toBe('#12#');
    expect(formatNonFungibleLocalId('String', '<abc>')).toBe('<abc>');
  });

  it('re-wraps an id typed in the wrong syntax', () => {
    expect(formatNonFungibleLocalId('String', '#12#')).toBe('<12>');
    expect(formatNonFungibleLocalId('Integer', '<12>')).toBe('#12#');
  });

  it('validates each type against its own shape', () => {
    expect(isValidNonFungibleLocalId('Integer', '#12#')).toBe(true);
    expect(isValidNonFungibleLocalId('Integer', '#abc#')).toBe(false);
    expect(isValidNonFungibleLocalId('String', '<a-b>')).toBe(false);
    expect(isValidNonFungibleLocalId('Bytes', '[c0ffe]')).toBe(false);
    expect(
      isValidNonFungibleLocalId(
        'Ruid',
        '{1111111111111111-2222222222222222-3333333333333333-4444444444444444}',
      ),
    ).toBe(true);
  });

  it('suggests the next free integer, and nothing for types it cannot guess', () => {
    expect(suggestNonFungibleLocalId('Integer', ['#1#', '#7#', '#3#'])).toBe('#8#');
    expect(suggestNonFungibleLocalId('Integer', [])).toBe('#1#');
    expect(suggestNonFungibleLocalId('String', ['<a>'])).toBe('');
    expect(suggestNonFungibleLocalId('Ruid', [])).toBe('');
  });

  it('mints RUID collections with the instruction that takes no id', () => {
    const nft = { id: '#1#', name: 'Seal', description: 'd', keyImageUrl: 'https://i' };
    const ruid = mintRuidNonFungibleManifest(RES, nft);
    expect(ruid).toContain('MINT_RUID_NON_FUNGIBLE');
    expect(ruid).toContain('Array<Tuple>');
    expect(ruid).not.toContain('NonFungibleLocalId');
  });

  it('picks the instruction from the collection type', () => {
    const nft = { id: '<abc>', name: 'n', description: 'd', keyImageUrl: '' };
    expect(mintNonFungibleForIdType(RES, 'Ruid', nft)).toContain('MINT_RUID_NON_FUNGIBLE');
    const byId = mintNonFungibleForIdType(RES, 'String', nft);
    expect(byId).toContain('MINT_NON_FUNGIBLE');
    expect(byId).toContain('NonFungibleLocalId("<abc>")');
  });

  it('keeps custom schema fields in both mint instructions', () => {
    const nft = {
      id: '#1#',
      name: 'n',
      description: 'd',
      keyImageUrl: '',
      customValues: [{ value: 'hash' }, { value: 'signer' }],
    };
    expect(mintNonFungibleManifest(RES, nft)).toContain('"signer"');
    expect(mintRuidNonFungibleManifest(RES, nft)).toContain('"signer"');
  });
});

/**
 * The Gateway spells the type `Ruid`, not `RUID`. Reading a pattern under the
 * wrong key threw `Cannot read properties of undefined (reading 'test')` and
 * took the whole tool down with it, so the mapping is now normalised and every
 * lookup survives a value nobody anticipated.
 */
describe('id type reported by the gateway', () => {
  it('accepts whatever casing the API uses', () => {
    expect(toNonFungibleIdKind('Ruid')).toBe('Ruid');
    expect(toNonFungibleIdKind('RUID')).toBe('Ruid');
    expect(toNonFungibleIdKind('ruid')).toBe('Ruid');
    expect(toNonFungibleIdKind('String')).toBe('String');
    expect(toNonFungibleIdKind('bytes')).toBe('Bytes');
    expect(toNonFungibleIdKind('Integer')).toBe('Integer');
  });

  it('falls back to Integer for anything unknown instead of crashing', () => {
    expect(toNonFungibleIdKind(undefined)).toBe('Integer');
    expect(toNonFungibleIdKind(null)).toBe('Integer');
    expect(toNonFungibleIdKind('SomethingNew')).toBe('Integer');
    expect(toNonFungibleIdKind(7)).toBe('Integer');
  });

  it('never throws on an id operation, whatever the kind', () => {
    const rogue = 'SomethingNew' as unknown as Parameters<typeof formatNonFungibleLocalId>[0];
    expect(() => formatNonFungibleLocalId(rogue, '12')).not.toThrow();
    expect(() => isValidNonFungibleLocalId(rogue, '#12#')).not.toThrow();
    expect(() => suggestNonFungibleLocalId(rogue, [])).not.toThrow();
  });

  it('shows RUID in caps to humans', () => {
    expect(nonFungibleIdKindLabel('Ruid')).toBe('RUID');
    expect(nonFungibleIdKindLabel('Integer')).toBe('Integer');
  });
});

/**
 * Editing one NFT's data is a different instruction from editing the
 * resource's metadata, and the console had neither reachable: a Radix Seal
 * collection deliberately leaves `key_image_url` mutable and nothing could
 * write it.
 */
describe('non-fungible data updates', () => {
  const RUID = '{fc429981a3b86067-8a101d948af996e5-a40af156b842c7cc-1f125aff1a4d38e8}';

  it('rewrites one field of one NFT', () => {
    const manifest = updateNonFungibleDataManifest(
      RES,
      RUID,
      'key_image_url',
      'https://img.example/new.png',
    );
    expect(manifest).toContain('UPDATE_NON_FUNGIBLE_DATA');
    expect(manifest).toContain(`NonFungibleLocalId("${RUID}")`);
    expect(manifest).toContain('"key_image_url"');
    expect(manifest).toContain('"https://img.example/new.png"');
    // Nothing about the resource's own metadata is touched.
    expect(manifest).not.toContain('SET_METADATA');
  });

  it('escapes quotes so a value cannot break out of the manifest', () => {
    const manifest = updateNonFungibleDataManifest(RES, '#1#', 'name', 'a" ; DROP');
    expect(manifest).toContain('a\\" ; DROP');
  });
});

/**
 * A mint must carry EVERY field the schema declares. A Radix Seal collection
 * adds nine of its own to the three standard ones, and sending only the three
 * is refused by the engine with
 * "expected_field_count: 12, found: 3".
 */
describe('minting into a custom schema', () => {
  const SIGN_FIELDS = [
    'signature',
    'a'.repeat(64),
    '2',
    ACC,
    '0',
    '1',
    '1',
    '',
    '2026-01-01T00:00:00.000Z',
  ];

  it('emits one value per custom field, after the three standard ones', () => {
    const manifest = mintNonFungibleManifest(RES, {
      id: '#1#',
      name: 'Signature',
      description: 'desc',
      keyImageUrl: 'https://img',
      customValues: SIGN_FIELDS.map((value) => ({ value })),
    });
    // 3 base + 9 custom, all inside the single data tuple.
    const tuple = manifest.slice(manifest.indexOf('Tuple('));
    expect(tuple.match(/"/g)!.length / 2).toBe(12);
    expect(manifest).toContain('"signature"');
    expect(manifest).toContain('"2026-01-01T00:00:00.000Z"');
  });

  it('keeps the values positional, empties included', () => {
    const manifest = mintNonFungibleManifest(RES, {
      id: '#1#',
      name: 'n',
      description: '',
      keyImageUrl: '',
      customValues: [{ value: 'first' }, { value: '' }, { value: 'third' }],
    });
    const values = [...manifest.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    // Address, then name, description, image, then the customs in order.
    expect(values.slice(-3)).toEqual(['first', '', 'third']);
  });

  it('still works for a plain resource with no custom fields', () => {
    const manifest = mintNonFungibleManifest(RES, {
      id: '#1#',
      name: 'n',
      description: 'd',
      keyImageUrl: 'https://i',
    });
    const tuple = manifest.slice(manifest.indexOf('Tuple('));
    expect(tuple.match(/"/g)!.length / 2).toBe(3);
  });
});

/**
 * A schema is not all strings. A `U64` field refuses `"5"` and wants `5u64`, a
 * `Decimal` wants `Decimal("1.5")`. Quoting everything worked only for the
 * all-string schemas this app creates.
 */
describe('typed NFT data fields', () => {
  it('writes each kind in its own manifest syntax', () => {
    expect(nftFieldLiteral('String', 'hola')).toBe('"hola"');
    expect(nftFieldLiteral(undefined, 'hola')).toBe('"hola"');
    expect(nftFieldLiteral('U64', '5')).toBe('5u64');
    expect(nftFieldLiteral('I32', '-7')).toBe('-7i32');
    expect(nftFieldLiteral('Bool', 'true')).toBe('true');
    expect(nftFieldLiteral('Bool', 'nope')).toBe('false');
    expect(nftFieldLiteral('Decimal', '1.5')).toBe('Decimal("1.5")');
    expect(nftFieldLiteral('NonFungibleLocalId', '#1#')).toBe(
      'NonFungibleLocalId("#1#")',
    );
    expect(nftFieldLiteral('Reference', RES)).toBe(`Address("${RES}")`);
  });

  it('refuses kinds a text box cannot express', () => {
    expect(nftFieldLiteral('Enum', 'x')).toBeNull();
    expect(nftFieldLiteral('Array', 'x')).toBeNull();
    expect(isEditableNftFieldKind('Enum')).toBe(false);
    expect(isEditableNftFieldKind('U64')).toBe(true);
  });

  it('never leaves a numeric field empty in the manifest', () => {
    expect(nftFieldLiteral('U64', '')).toBe('0u64');
    expect(nftFieldLiteral('Decimal', '')).toBe('Decimal("0")');
  });

  it('offers the type and a sample as a placeholder', () => {
    expect(nftFieldPlaceholder('U64')).toBe('U64 · 64');
    expect(nftFieldPlaceholder('Decimal')).toBe('Decimal · 1.5');
    expect(nftFieldPlaceholder(undefined)).toBe('');
  });

  it('carries the kind through a mint and an update', () => {
    const mint = mintNonFungibleManifest(RES, {
      id: '#1#',
      name: 'n',
      description: 'd',
      keyImageUrl: '',
      customValues: [{ value: '7', kind: 'U64' }, { value: 'x' }],
    });
    expect(mint).toContain('7u64');
    expect(mint).toContain('"x"');
    expect(updateNonFungibleDataManifest(RES, '#1#', 'count', '9', 'U32')).toContain(
      '9u32',
    );
  });
});
