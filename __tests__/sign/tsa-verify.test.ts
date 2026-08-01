import { describe, expect, it } from 'vitest';
import {
  verifyTimeStampToken,
  verifyTimeStampTokenBase64,
} from '@/features/sign/lib/tsa-verify';
import {
  buildTimeStampRequest,
  extractTimeStampToken,
  readNode,
} from '@/features/sign/lib/tsa';
import {
  signedAtAgrees,
  timestampImprintInput,
} from '@/features/sign/lib/timestamp';
import {
  FREETSA_TOKEN_BASE64,
  FREETSA_TOKEN_GEN_TIME,
  FREETSA_TOKEN_IMPRINT,
} from '../fixtures/tsa-token';

const tokenBytes = () => Uint8Array.from(Buffer.from(FREETSA_TOKEN_BASE64, 'base64'));

describe('RFC 3161 request encoding', () => {
  it('matches the DER openssl ts -query produces', () => {
    const der = buildTimeStampRequest(FREETSA_TOKEN_IMPRINT);
    const hex = [...der].map((b) => b.toString(16).padStart(2, '0')).join('');
    // SEQUENCE { INTEGER 1, SEQUENCE { SEQUENCE { OID sha256, NULL }, OCTET
    // STRING imprint }, INTEGER nonce, BOOLEAN TRUE }. The nonce is random, so
    // the head and the tail are pinned and the 8 nonce bytes are not.
    expect(hex.startsWith('30430201013031300d060960864801650304020105000420')).toBe(
      true,
    );
    expect(hex).toContain(FREETSA_TOKEN_IMPRINT);
    expect(hex.endsWith('0101ff')).toBe(true);
    expect(der.length).toBe(0x45);
  });

  it('asks for the authority certificates, without which nobody could verify', () => {
    const der = buildTimeStampRequest(FREETSA_TOKEN_IMPRINT);
    expect(der[der.length - 3]).toBe(0x01); // BOOLEAN
    expect(der[der.length - 1]).toBe(0xff); // certReq TRUE
  });

  it('rejects a response whose status is not granted', () => {
    // TimeStampResp { PKIStatusInfo { INTEGER 2 (rejection) } } and no token.
    const rejected = Uint8Array.from([0x30, 0x05, 0x30, 0x03, 0x02, 0x01, 0x02]);
    expect(extractTimeStampToken(rejected)).toBeNull();
  });

  it('refuses non-DER indefinite lengths instead of guessing', () => {
    expect(readNode(Uint8Array.from([0x30, 0x80, 0x00, 0x00]), 0)).toBeNull();
  });
});

describe('timestamp token verification', () => {
  it('verifies a real freetsa token and reports its asserted time', () => {
    const result = verifyTimeStampTokenBase64(
      FREETSA_TOKEN_BASE64,
      FREETSA_TOKEN_IMPRINT,
    );
    expect(result.reason).toBeUndefined();
    expect(result.valid).toBe(true);
    expect(result.genTime).toBe(FREETSA_TOKEN_GEN_TIME);
    expect(result.authority).toBe('www.freetsa.org');
  });

  it('recognises the freetsa root as a trusted anchor', () => {
    const result = verifyTimeStampTokenBase64(
      FREETSA_TOKEN_BASE64,
      FREETSA_TOKEN_IMPRINT,
    );
    expect(result.trusted).toBe(true);
    expect(result.anchorFingerprint).toBe(
      'a6379e7cecc05faa3cbf076013d745e327bbbaa38c0b9af22469d4701d18aabc',
    );
  });

  it('refuses a token that timestamps a different imprint', () => {
    const result = verifyTimeStampTokenBase64(
      FREETSA_TOKEN_BASE64,
      'f'.repeat(64),
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('imprint_mismatch');
  });

  it('refuses a token whose signed bytes were altered', () => {
    const der = tokenBytes();
    // Flip a byte deep inside the TSTInfo: the imprint still matches, but the
    // messageDigest attribute no longer describes the content it signs.
    const marker = der.indexOf(0x18); // GeneralizedTime tag inside TSTInfo
    der[marker + 4] = der[marker + 4] === 0x39 ? 0x38 : 0x39;
    const result = verifyTimeStampToken(der, FREETSA_TOKEN_IMPRINT);
    expect(result.valid).toBe(false);
  });

  it('refuses a truncated token rather than reporting a partial result', () => {
    const der = tokenBytes().slice(0, 200);
    expect(verifyTimeStampToken(der, FREETSA_TOKEN_IMPRINT).valid).toBe(false);
  });

  it('refuses garbage', () => {
    expect(verifyTimeStampTokenBase64('bm90IGEgdG9rZW4=', FREETSA_TOKEN_IMPRINT).valid).toBe(
      false,
    );
    expect(verifyTimeStampTokenBase64('', FREETSA_TOKEN_IMPRINT).valid).toBe(false);
  });
});

describe('imprint derivation', () => {
  it('binds signer, document challenge and signature together', () => {
    const base = timestampImprintInput('account_tdx_2_1abc', 'AB'.repeat(32), 'FF00');
    expect(base).toBe(
      `radix-seal-timestamp:v1|account_tdx_2_1abc|${'ab'.repeat(32)}|ff00`,
    );
    // Any of the three changing must change the imprint, or a token could be
    // moved from one signature to another.
    expect(timestampImprintInput('account_tdx_2_1xyz', 'AB'.repeat(32), 'FF00')).not.toBe(
      base,
    );
    expect(timestampImprintInput('account_tdx_2_1abc', 'CD'.repeat(32), 'FF00')).not.toBe(
      base,
    );
    expect(timestampImprintInput('account_tdx_2_1abc', 'AB'.repeat(32), 'FF01')).not.toBe(
      base,
    );
  });
});

describe('declared time against an independent clock', () => {
  const anchor = '2026-07-31T20:27:05.000Z';

  it('accepts a declared time within the tolerance', () => {
    expect(signedAtAgrees('2026-07-31T20:25:00.000Z', anchor)).toBe(true);
  });

  it('rejects a backdated one', () => {
    expect(signedAtAgrees('2020-01-01T00:00:00.000Z', anchor)).toBe(false);
  });

  it('claims nothing when there is no anchor to compare against', () => {
    expect(signedAtAgrees('2020-01-01T00:00:00.000Z', null)).toBeNull();
  });

  it('treats an unparseable declared time as disagreement', () => {
    expect(signedAtAgrees('whenever', anchor)).toBe(false);
  });
});
