// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { buildDeliverablePdf } from '@/features/sign/lib/signed-pdf';
import { extractRadixAttachments } from '@/features/sign/lib/pdf-extract';
import type { AttestationEnvelope } from '@/features/sign/types/sign.types';

const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function env(): AttestationEnvelope {
  return {
    payload: { v: 1, docHash: 'a'.repeat(64), hashAlg: 'blake2b-256',
      fileName: 'c.pdf', fileSize: 10, message: '', disclosure: 'none',
      email: false, signers: [], timestamp: '2026-07-24T09:00:00.000Z',
      networkId: 1, nonce: 'b'.repeat(64) },
    signatures: [{ signerAccount: 'account_rdx12a', disclosedName: null,
      disclosedEmail: null, proof: { publicKey: 'ab', signature: 'cd', curve: 'curve25519' },
      signedAt: '2026-07-24T09:00:07.000Z' }],
    onChain: null, request: null,
  };
}

async function blank(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  d.addPage([595, 842]).drawText('c', { x: 60, y: 700, size: 12, font: f });
  return d.save();
}

describe('watermark survives co-signing', () => {
  it('travels inside the signed PDF and is recovered by the next signer', async () => {
    const original = await blank();
    const watermark = { kind: 'own' as const, text: 'CONFIDENCIAL', imageUrl: PNG };

    const signed = await buildDeliverablePdf({
      fileBytes: original, envelope: env(), watermark,
    });

    // What the co-signer's dropzone sees when the signed PDF is dropped.
    const att = await extractRadixAttachments(signed);
    expect(att.watermark).toEqual(watermark);
    expect(att.originalBytes).not.toBeNull();

    // Re-delivering with the recovered spec keeps the image on the carrier.
    const reSigned = await buildDeliverablePdf({
      fileBytes: att.originalBytes!, envelope: env(), watermark: att.watermark!,
    });
    const again = await extractRadixAttachments(reSigned);
    expect(again.watermark).toEqual(watermark);
    // The carrier really is watermarked (an image XObject was embedded).
    expect(Buffer.from(reSigned).toString('latin1')).toContain('/Subtype /Image');
  });

  it('attaches nothing when there is no watermark', async () => {
    const signed = await buildDeliverablePdf({
      fileBytes: await blank(), envelope: env(), watermark: { kind: 'none' },
    });
    expect((await extractRadixAttachments(signed)).watermark).toBeNull();
  });
});
