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

/**
 * The transactions behind the record. A reader holding the PDF should not have
 * to search a ledger to find the mint it is talking about, so the certificate
 * names it — the request's transaction and each signature's — and the visible
 * page turns both into links.
 */
describe('on-ledger certificate transactions', () => {
  const REQUEST_TX = 'txid_tdx_2_1request000000000000000000000000';
  const SIGNATURE_TX = 'txid_tdx_2_1signature00000000000000000000';

  it('records the transaction that minted each signature', () => {
    const envelope = buildOnChainCertificate({
      ...base,
      signedAccounts: [
        { account: SIGNER_A, signedAt: '2026-07-20T09:15:00.000Z', txId: SIGNATURE_TX },
      ],
      requestId: 'resource_tdx_2_1coll:#1#',
      requestTxId: REQUEST_TX,
    });
    expect(envelope.signatures[0].transactionIntentHash).toBe(SIGNATURE_TX);
    expect(envelope.request?.transactionIntentHash).toBe(REQUEST_TX);
  });

  it('omits the field entirely when the ledger could not resolve it', () => {
    // Absent, never an empty string: the certificate says nothing rather than
    // pointing the reader at a transaction that does not exist.
    const envelope = buildOnChainCertificate({
      ...base,
      signedAccounts: [{ account: SIGNER_A, txId: null }],
      requestId: 'resource_tdx_2_1coll:#1#',
    });
    expect('transactionIntentHash' in envelope.signatures[0]).toBe(false);
    expect(envelope.request).toEqual({
      networkId: 2,
      requestId: 'resource_tdx_2_1coll:#1#',
    });
  });
});
