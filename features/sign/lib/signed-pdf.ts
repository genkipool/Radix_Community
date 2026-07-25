/**
 * The ONE place that assembles a delivered, signed PDF. Every download and
 * every shared artifact goes through here, so all of them carry exactly the
 * same layers — previously each call site rebuilt the pipeline by hand and they
 * drifted (the result panel's "download PDF" silently lost the watermark).
 *
 * The order is load-bearing and must not change:
 *
 *   1. watermark   — a visible layer on the carrier only
 *   2. embed       — visible certificate page + certificate JSON + the INTACT
 *                    original document (what verification re-hashes, which is
 *                    why steps 1/3 never affect the document hash)
 *   3. PAdES       — the X.509 signature, LAST: any later byte change would
 *                    invalidate it
 */
import type { AttestationEnvelope } from '../types/sign.types';
import { embedCertificateInPdf } from './pdf-embed';
import type { CertificatePageOptions } from './pdf-signature-page';
import { applyWatermark, type WatermarkOptions } from './pdf-watermark';
import { signPdfWithP12 } from './pdf-pades';

/** The certificate-signing inputs, as collected by the UI. */
export interface PadesDelivery {
  enabled: boolean;
  file: File | null;
  password: string;
  reason: string;
  location: string;
}

export interface DeliverablePdfInput {
  /** ORIGINAL document bytes (the ones the signatures commit to). */
  fileBytes: Uint8Array;
  envelope: AttestationEnvelope;
  /** Visible watermark for the carrier; omit for none. */
  watermark?: WatermarkOptions;
  /** Visible signature-certificate page; omit to embed attachments only. */
  pageOptions?: CertificatePageOptions;
  /** Certificate signature; skipped unless enabled with a file. */
  pades?: PadesDelivery | null;
}

/**
 * Builds the final PDF. Watermarking is best-effort (it never throws), the
 * embedding step throws only on a broken PDF, and PAdES throws on a bad
 * certificate/password so the caller can surface it rather than hand over a
 * file that silently lacks the requested signature.
 */
export async function buildDeliverablePdf({
  fileBytes,
  envelope,
  watermark,
  pageOptions,
  pades,
}: DeliverablePdfInput): Promise<Uint8Array> {
  const carrier = watermark
    ? await applyWatermark(fileBytes, watermark)
    : fileBytes;

  // The ORIGINAL bytes go in intact (third arg), so the document hash holds.
  // The watermark spec rides along so the next signer can re-apply the very
  // same one after rebuilding the PDF from that original.
  const embedded = await embedCertificateInPdf(
    carrier,
    envelope,
    fileBytes,
    pageOptions,
    watermark,
  );

  if (!pades?.enabled || !pades.file) return embedded;

  const p12Bytes = new Uint8Array(await pades.file.arrayBuffer());
  return signPdfWithP12({
    pdfBytes: embedded,
    p12Bytes,
    passphrase: pades.password,
    reason: pades.reason.trim() || envelope.payload.message.trim() || undefined,
    location: pades.location.trim() || undefined,
    name: envelope.signatures[0]?.disclosedName ?? undefined,
  });
}
