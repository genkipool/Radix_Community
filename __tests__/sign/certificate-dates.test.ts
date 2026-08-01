import { describe, expect, it } from 'vitest';
import { buildOnChainCertificate } from '@/features/sign/lib/certificate';

const SIGNER_A =
  'account_rdx169490zsun80mg3y0j23ghccm2sw0a4f0rdshxnj2alqcj98ctuzhqw';
const SIGNER_B =
  'account_rdx1283533slsjtx5r5efdj8c9864vsrg3p3vrw9cr25qyq8f0adlvvuc7';
const DOC_HASH =
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

const base = {
  docHash: DOC_HASH,
  fileName: 'contract.pdf',
  fileSize: 1024,
  networkId: 2,
  requiredSigners: [SIGNER_A, SIGNER_B],
  nonce: 'a'.repeat(64),
};

describe('on-ledger certificate dates', () => {
  it('records each signature at the time the ledger says, not the download time', () => {
    // The certificate is typically downloaded days after the signing. Stamping
    // it with "now" would print a date the ledger itself contradicts.
    const envelope = buildOnChainCertificate({
      ...base,
      signedAccounts: [
        { account: SIGNER_A, signedAt: '2026-07-20T09:15:00.000Z' },
        { account: SIGNER_B, signedAt: '2026-07-22T17:40:00.000Z' },
      ],
    });
    expect(envelope.signatures.map((s) => s.signedAt)).toEqual([
      '2026-07-20T09:15:00.000Z',
      '2026-07-22T17:40:00.000Z',
    ]);
  });

  it('falls back to now only when the ledger time could not be read', () => {
    const before = Date.now();
    const envelope = buildOnChainCertificate({
      ...base,
      signedAccounts: [
        { account: SIGNER_A, signedAt: null },
        { account: SIGNER_B },
      ],
    });
    for (const signature of envelope.signatures) {
      const when = Date.parse(signature.signedAt);
      expect(when).toBeGreaterThanOrEqual(before - 1000);
      expect(when).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });

  it('carries no ROLA proof: each signature stands on its on-ledger NFT', () => {
    const envelope = buildOnChainCertificate({
      ...base,
      signedAccounts: [{ account: SIGNER_A, signedAt: '2026-07-20T09:15:00.000Z' }],
    });
    expect(envelope.signatures[0].proof).toBeNull();
    expect(envelope.signatures[0].timeStampToken).toBeUndefined();
  });
});
