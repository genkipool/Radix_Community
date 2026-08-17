import { describe, it, expect } from 'vitest';
import { requestPdfName, signedPdfName } from '@/features/sign/lib/file';
import { isFullySigned } from '@/features/sign/lib/certificate';
import type { AttestationEnvelope } from '@/features/sign/types/sign.types';

/**
 * A multi-party document travels from signer to signer AS A PDF: each one
 * downloads what the previous one delivered and hands it on. Appending
 * `-signed` at every hand-off therefore stacked one word per signer
 * (`contrato-signed-signed-signed.pdf`), and none of them was true until the
 * last: the file said "signed" while it still needed two more signatures.
 */
describe('delivered PDF names', () => {
  it('adds -signed once the document is fully signed', () => {
    expect(signedPdfName('contrato.pdf', true)).toBe('contrato-signed.pdf');
  });

  it('leaves a partially signed document under its own name', () => {
    expect(signedPdfName('contrato.pdf', false)).toBe('contrato.pdf');
  });

  it('never stacks the suffix, however many hand-offs it went through', () => {
    expect(signedPdfName('contrato-signed.pdf', false)).toBe('contrato.pdf');
    expect(signedPdfName('contrato-signed-signed-signed.pdf', true)).toBe(
      'contrato-signed.pdf',
    );
    expect(signedPdfName('contrato_signed.pdf', true)).toBe('contrato-signed.pdf');
  });

  it('drops the request suffix when that PDF comes back signed', () => {
    expect(signedPdfName('contrato-request.pdf', true)).toBe('contrato-signed.pdf');
    expect(requestPdfName('contrato-signed.pdf')).toBe('contrato-request.pdf');
  });

  it('keeps a name that is nothing but the suffix', () => {
    // Stripping everything would leave `.pdf`, a file with no name at all.
    expect(signedPdfName('signed.pdf', true)).toBe('signed-signed.pdf');
  });
});

function envelope(
  signers: string[],
  signed: string[],
): AttestationEnvelope {
  return {
    payload: {
      v: 1,
      docHash: 'a'.repeat(64),
      hashAlg: 'blake2b-256',
      fileName: 'contrato.pdf',
      fileSize: 10,
      message: '',
      disclosure: 'none',
      email: false,
      signers,
      timestamp: '2026-07-23T09:21:05.000Z',
      networkId: 1,
      nonce: 'b'.repeat(64),
    },
    signatures: signed.map((account) => ({
      signerAccount: account,
      disclosedName: null,
      disclosedEmail: null,
      proof: null,
      signedAt: '2026-07-23T09:21:05.000Z',
    })),
    onChain: null,
    request: null,
  };
}

describe('isFullySigned', () => {
  it('is true only when every required signer has signed', () => {
    expect(isFullySigned(envelope(['a', 'b'], ['a']))).toBe(false);
    expect(isFullySigned(envelope(['a', 'b'], ['a', 'b']))).toBe(true);
  });

  it('treats an open certificate as complete on its first signature', () => {
    expect(isFullySigned(envelope([], []))).toBe(false);
    expect(isFullySigned(envelope([], ['a']))).toBe(true);
  });
});
