import { describe, it, expect } from 'vitest';
import {
  buildOlympiaExportPayloads,
  sanitizeAccountName,
  type OlympiaExportAccount,
} from '@/features/console/lib/olympia-export';

// secp256k1 generator-point public key (privkey = 1), compressed
const PUBKEY_HEX = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const PUBKEY_B64 = 'Anm+Zn753LusVaBilc6HCwcCm/zbLc4o2VnygVsW+BeY';

const account = (overrides: Partial<OlympiaExportAccount> = {}): OlympiaExportAccount => ({
  accountType: 'S',
  publicKeyHex: PUBKEY_HEX,
  addressIndex: 0,
  name: 'Test',
  ...overrides,
});

describe('buildOlympiaExportPayloads', () => {
  it('builds the exact single-account payload the Olympia Desktop Wallet produces', () => {
    const payloads = buildOlympiaExportPayloads([account()], 12);
    expect(payloads).toEqual([`1^0^12]S^${PUBKEY_B64}^0^Test}`]);
  });

  it('encodes hardware accounts with type H and the given index', () => {
    const payloads = buildOlympiaExportPayloads(
      [account({ accountType: 'H', addressIndex: 5, name: 'Ledger one' })],
      24,
    );
    expect(payloads).toEqual([`1^0^24]H^${PUBKEY_B64}^5^Ledger one}`]);
  });

  it('joins multiple accounts with ~', () => {
    const [payload] = buildOlympiaExportPayloads(
      [account({ name: 'A' }), account({ addressIndex: 1, name: 'B' })],
      12,
    );
    expect(payload).toBe(`1^0^12]S^${PUBKEY_B64}^0^A}~S^${PUBKEY_B64}^1^B}`);
  });

  it('splits payloads over 1800 chars into sequenced chunks', () => {
    const accounts = Array.from({ length: 40 }, (_, i) =>
      account({ addressIndex: i, name: `Account number ${i}` }),
    );
    const payloads = buildOlympiaExportPayloads(accounts, 12);
    expect(payloads.length).toBeGreaterThan(1);
    payloads.forEach((payload, i) => {
      expect(payload.startsWith(`${payloads.length}^${i}^12]`)).toBe(true);
    });
    // Re-joining the chunk bodies restores the full account list
    const joined = payloads.map((p) => p.slice(p.indexOf(']') + 1)).join('');
    expect(joined.split('~')).toHaveLength(40);
  });

  it('round-trips through the Babylon wallet parser logic', () => {
    const [payload] = buildOlympiaExportPayloads(
      [account({ accountType: 'H', addressIndex: 3, name: 'Round trip' })],
      18,
    );
    // Mirror OlympiaWalletDataParser.kt
    const [header, body] = payload.split(']');
    expect(header.split('^')).toEqual(['1', '0', '18']);
    const [type, b64, index, name] = body.split('^');
    expect(type).toBe('H');
    expect(index).toBe('3');
    expect(name).toBe('Round trip}');
    const decodedHex = [...atob(b64)]
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
    expect(decodedHex).toBe(PUBKEY_HEX);
  });

  it('rejects malformed public keys', () => {
    expect(() => buildOlympiaExportPayloads([account({ publicKeyHex: 'abc123' })], 12)).toThrow();
  });
});

describe('sanitizeAccountName', () => {
  it('terminates the name with }', () => {
    expect(sanitizeAccountName('Savings')).toBe('Savings}');
  });

  it('replaces separator characters used by the format', () => {
    expect(sanitizeAccountName('a]b^c~d}e')).toBe('a_b_c_d_e}');
  });

  it('replaces non-ASCII characters and truncates to 30 chars', () => {
    expect(sanitizeAccountName('Ahorro año 🚀')).toBe('Ahorro a_o _}');
    expect(sanitizeAccountName('x'.repeat(50))).toBe(`${'x'.repeat(30)}}`);
  });
});
