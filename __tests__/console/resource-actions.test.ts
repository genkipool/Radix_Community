import { describe, it, expect } from 'vitest';
import {
  accessRuleSyntax,
  burnManifest,
  burnNonFungibleManifest,
  freezeVaultManifest,
  lockMetadataManifest,
  mintFungibleManifest,
  mintNonFungibleManifest,
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
