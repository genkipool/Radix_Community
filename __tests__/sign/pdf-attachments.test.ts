// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { embedCertificateInPdf } from '@/features/sign/lib/pdf-embed';
import { extractRadixAttachments, isPdfBytes } from '@/features/sign/lib/pdf-extract';
import { applyWatermark } from '@/features/sign/lib/pdf-watermark';
import type { AttestationEnvelope } from '@/features/sign/types/sign.types';

async function blankPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  return doc.save();
}

const envelope: AttestationEnvelope = {
  payload: {
    v: 1,
    docHash: 'ab'.repeat(32),
    hashAlg: 'blake2b-256',
    fileName: 'contrato.pdf',
    fileSize: 12,
    message: 'hi',
    disclosure: 'full_name',
    email: false,
    signers: [],
    timestamp: '2026-07-11T00:00:00.000Z',
    networkId: 2,
    nonce: 'cd'.repeat(32),
  },
  signatures: [],
  onChain: null,
};

describe('pdf attachments roundtrip', () => {
  it('embeds cert + original and extracts them back byte-for-byte', async () => {
    const pdf = await blankPdf();
    const original = new TextEncoder().encode('the original document bytes');

    const signed = await embedCertificateInPdf(pdf, envelope, original);
    expect(isPdfBytes(signed)).toBe(true);

    const extracted = await extractRadixAttachments(signed);
    expect(extracted.envelope?.payload.docHash).toBe(envelope.payload.docHash);
    expect(extracted.originalBytes).toEqual(original);
    expect(extracted.originalName).toBe('contrato.pdf');
  });

  it('survives a watermark applied before embedding', async () => {
    const pdf = await blankPdf();
    const original = new TextEncoder().encode('original');
    const stamped = await applyWatermark(pdf, { kind: 'seal' });
    expect(isPdfBytes(stamped)).toBe(true);

    const signed = await embedCertificateInPdf(stamped, envelope, original);
    const extracted = await extractRadixAttachments(signed);
    expect(extracted.originalBytes).toEqual(original);
    expect(extracted.envelope).not.toBeNull();
  });

  it('returns nulls for a PDF with no Radix attachments', async () => {
    const extracted = await extractRadixAttachments(await blankPdf());
    expect(extracted.envelope).toBeNull();
    expect(extracted.originalBytes).toBeNull();
  });

  it('never throws on non-PDF input', async () => {
    const extracted = await extractRadixAttachments(new Uint8Array([1, 2, 3]));
    expect(extracted.envelope).toBeNull();
    expect(isPdfBytes(new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('own text watermark produces a valid PDF', async () => {
    const out = await applyWatermark(await blankPdf(), {
      kind: 'own',
      text: 'CONFIDENTIAL',
    });
    expect(isPdfBytes(out)).toBe(true);
  });
});
