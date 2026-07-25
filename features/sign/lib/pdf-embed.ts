/**
 * Embeds the attestation certificate — and the ORIGINAL document bytes —
 * INSIDE a PDF as attached files, producing a self-verifying signed PDF.
 *
 * Why the original too: the delivered PDF is watermarked/attached, so its
 * bytes differ from what was hashed. Carrying the original lets a verifier
 * recover it, re-hash it and confirm `payload.docHash` from the single file
 * that was shared (see pdf-extract.ts).
 *
 * `pdf-lib` is loaded lazily (dynamic import) so it is only pulled into the
 * bundle when a user actually chooses the "embedded PDF" output. The PDF is
 * the user's OWN file, in their OWN browser, and is never uploaded.
 */
import type { AttestationEnvelope } from '../types/sign.types';
import {
  appendSignaturePage,
  type CertificatePageOptions,
} from './pdf-signature-page';
import type { WatermarkOptions } from './pdf-watermark';

/** Attachment names — the extractor looks these up. */
export const CERT_ATTACHMENT = 'radix-certificate.radixsig.json';
export const ORIGINAL_ATTACHMENT_PREFIX = 'radix-original';
export const REQUEST_ATTACHMENT = 'radix-request.json';
export const WATERMARK_ATTACHMENT = 'radix-watermark.json';

/**
 * Pointer to an on-ledger signing request, embedded into the shared PDF so
 * the file is self-describing: dropping it into the tool auto-loads the
 * request. It is only a POINTER — verification always re-reads the request
 * from the ledger and re-hashes the embedded original, so a tampered pointer
 * simply fails to match.
 */
export interface RequestPointer {
  v: 1;
  /** Request key: `resource:#0#` (standard) or a resource address (strict). */
  requestKey: string;
  networkId: number;
  /** Blake2b-256 of the ORIGINAL document bytes. */
  docHash: string;
}

/**
 * Returns a new PDF identical to `pdfBytes` (already watermarked, if any) but
 * with the certificate and the original file attached. Throws on a bad PDF.
 *
 * When `signaturePage` is given, a VISIBLE signature-certificate page is also
 * appended (best-effort: a rendering hiccup never blocks the attachments). The
 * page is presentation only — the intact original is still embedded, so the
 * document hash is unaffected (see pdf-signature-page.ts).
 */
export async function embedCertificateInPdf(
  pdfBytes: Uint8Array,
  envelope: AttestationEnvelope,
  originalBytes?: Uint8Array,
  signaturePage?: CertificatePageOptions,
  /**
   * The watermark that was stamped on this carrier. Attached so it TRAVELS with
   * the document: co-signing rebuilds the PDF from the intact original, which
   * would otherwise drop the initiator's watermark on every new signature.
   */
  watermarkSpec?: WatermarkOptions,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  if (signaturePage) {
    try {
      await appendSignaturePage(pdfDoc, envelope, signaturePage);
    } catch {
      // Visible page is optional; keep the machine-readable attachments below.
    }
  }

  const certJson = new TextEncoder().encode(JSON.stringify(envelope, null, 2));
  await pdfDoc.attach(certJson as Uint8Array<ArrayBuffer>, CERT_ATTACHMENT, {
    mimeType: 'application/json',
    description: 'Radix off-ledger document attestation certificate',
    creationDate: new Date(envelope.payload.timestamp),
    modificationDate: new Date(envelope.payload.timestamp),
  });

  if (originalBytes) {
    // Keep the original extension so verifiers can name/type it correctly.
    const name = `${ORIGINAL_ATTACHMENT_PREFIX}-${envelope.payload.fileName}`;
    await pdfDoc.attach(originalBytes as Uint8Array<ArrayBuffer>, name, {
      mimeType: 'application/octet-stream',
      description: 'Original signed document (for verification)',
      creationDate: new Date(envelope.payload.timestamp),
      modificationDate: new Date(envelope.payload.timestamp),
    });
  }

  if (watermarkSpec && watermarkSpec.kind !== 'none') {
    const wmJson = new TextEncoder().encode(JSON.stringify(watermarkSpec));
    await pdfDoc.attach(wmJson as Uint8Array<ArrayBuffer>, WATERMARK_ATTACHMENT, {
      mimeType: 'application/json',
      description: 'Watermark applied to this document (presentation only)',
      creationDate: new Date(envelope.payload.timestamp),
      modificationDate: new Date(envelope.payload.timestamp),
    });
  }

  // Surface the signers in the document properties for at-a-glance visibility.
  pdfDoc.setKeywords([
    'radix-attestation',
    `hash:${envelope.payload.docHash}`,
    `signers:${envelope.signatures.map((s) => s.signerAccount).join(',')}`,
  ]);

  return pdfDoc.save();
}

/**
 * Returns a new PDF with the on-ledger request pointer and the ORIGINAL
 * document bytes attached, so signers can be sent ONE self-describing file:
 * dropping it into the tool restores the original (hash source) and
 * auto-loads the request. See `RequestPointer`.
 */
export async function embedRequestInPdf(
  pdfBytes: Uint8Array,
  pointer: RequestPointer,
  originalBytes: Uint8Array,
  originalName: string,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const now = new Date();

  const pointerJson = new TextEncoder().encode(JSON.stringify(pointer, null, 2));
  await pdfDoc.attach(pointerJson as Uint8Array<ArrayBuffer>, REQUEST_ATTACHMENT, {
    mimeType: 'application/json',
    description: 'Radix on-ledger signing request pointer',
    creationDate: now,
    modificationDate: now,
  });

  await pdfDoc.attach(
    originalBytes as Uint8Array<ArrayBuffer>,
    `${ORIGINAL_ATTACHMENT_PREFIX}-${originalName}`,
    {
      mimeType: 'application/octet-stream',
      description: 'Original document (for verification)',
      creationDate: now,
      modificationDate: now,
    },
  );

  pdfDoc.setKeywords([
    'radix-signing-request',
    `hash:${pointer.docHash}`,
    `request:${pointer.requestKey}`,
  ]);

  return pdfDoc.save();
}
