/**
 * Embeds the attestation certificate INSIDE a PDF as an attached file.
 *
 * `pdf-lib` is loaded lazily (dynamic import) so it is only pulled into the
 * bundle when a user actually chooses the "embedded PDF" output. The PDF being
 * parsed is the user's OWN file, in their OWN browser, and is never uploaded —
 * so this does not add server-side attack surface.
 */
import type { AttestationEnvelope } from '../types/sign.types';

/**
 * Returns a new PDF (bytes) identical to the original but with the certificate
 * attached as an embedded file named `<original>.radixsig.json`.
 * Throws if the input is not a valid PDF.
 */
export async function embedCertificateInPdf(
  pdfBytes: Uint8Array,
  envelope: AttestationEnvelope,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  const certJson = new TextEncoder().encode(JSON.stringify(envelope, null, 2));
  await pdfDoc.attach(certJson, `${envelope.payload.fileName}.radixsig.json`, {
    mimeType: 'application/json',
    description: 'Radix off-ledger document attestation certificate',
    creationDate: new Date(envelope.payload.timestamp),
    modificationDate: new Date(envelope.payload.timestamp),
  });

  // Surface the signers in the document properties for at-a-glance visibility.
  pdfDoc.setKeywords([
    'radix-attestation',
    `hash:${envelope.payload.docHash}`,
    `signers:${envelope.signatures.map((s) => s.signerAccount).join(',')}`,
  ]);

  return pdfDoc.save();
}
