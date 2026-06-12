import { describe, it, expect } from 'vitest';
import { inspectAddress, verifyBech32mChecksum } from '@/features/console/lib/address-inspect';

// Real addresses (checksums verified against the network)
const MAINNET_ACCOUNT = 'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw';
const STOKENET_ACCOUNT = 'account_tdx_2_169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ccn09n5';
const MAINNET_XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

describe('verifyBech32mChecksum', () => {
  it('accepts valid addresses', () => {
    expect(verifyBech32mChecksum(MAINNET_ACCOUNT)).toBe(true);
    expect(verifyBech32mChecksum(STOKENET_ACCOUNT)).toBe(true);
    expect(verifyBech32mChecksum(MAINNET_XRD)).toBe(true);
  });

  it('rejects typos and garbage', () => {
    expect(verifyBech32mChecksum(MAINNET_ACCOUNT.replace(/.$/, 'x'))).toBe(false);
    expect(verifyBech32mChecksum('account_rdx1notvalid')).toBe(false);
    expect(verifyBech32mChecksum('hello')).toBe(false);
  });
});

describe('inspectAddress', () => {
  it('classifies entity type and network', () => {
    expect(inspectAddress(MAINNET_ACCOUNT)).toMatchObject({
      entityType: 'account',
      network: 'mainnet',
      checksumValid: true,
    });
    expect(inspectAddress(STOKENET_ACCOUNT)).toMatchObject({
      entityType: 'account',
      network: 'stokenet',
      checksumValid: true,
    });
    expect(inspectAddress(MAINNET_XRD)).toMatchObject({
      entityType: 'resource',
      network: 'mainnet',
    });
    expect(inspectAddress('internal_vault_tdx_2_1tz9uaalv8g3ahmwep2trlyj2m3zn7rstm9pwessa3k56me2fuywfep')).toMatchObject({
      entityType: 'internalVault',
      network: 'stokenet',
    });
  });

  it('returns null for non-bech32 input', () => {
    expect(inspectAddress('not an address')).toBeNull();
  });
});
