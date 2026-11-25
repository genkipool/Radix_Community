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
import type { AttestationEnvelope, OutputFormat } from '../types/sign.types';
import type { SignDictionary } from '../types/dictionary';
import {
  downloadBytes,
  downloadCertificate,
  isFullySigned,
} from './certificate';
import { signedPdfName } from './file';
import { embedCertificateInPdf } from './pdf-embed';
import {
  signaturePageOptions,
  type CertificatePageOptions,
} from './pdf-signature-page';
import { applyWatermark, type WatermarkOptions } from './pdf-watermark';
import { signPdfWithP12 } from './pdf-pades';

/** True when a file/result represents a PDF by MIME type or `.pdf` suffix. */
export function isPdfFile(file: {
  fileType?: string;
  type?: string;
  fileName?: string;
  name?: string;
}): boolean {
  const mime = file.fileType ?? file.type ?? '';
  const name = file.fileName ?? file.name ?? '';
  return mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}

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

export interface DeliverArtifactsInput {
  envelope: AttestationEnvelope;
  fileBytes: Uint8Array | null;
  fileName: string;
  fileType: string;
  outputs: OutputFormat[];
  t: SignDictionary;
  locale: string;
  watermark?: WatermarkOptions;
  pades?: PadesDelivery | null;
  /** Called when a requested PAdES signature fails (instead of silent fallback). */
  onPadesError?: (err: unknown) => void;
}

/**
 * Single source of truth for delivering signed artifacts to the browser
 * (embedded PDF with watermark + visible page + optional PAdES, and/or
 * detached `.radixsig.json` certificate).
 */
export async function deliverSignedArtifacts({
  envelope,
  fileBytes,
  fileName,
  fileType,
  outputs,
  t,
  locale,
  watermark,
  pades,
  onPadesError,
}: DeliverArtifactsInput): Promise<void> {
  const padesActive = !!pades?.enabled;
  let deliveredPdf = false;

  if (
    outputs.includes('embedded') &&
    fileBytes &&
    isPdfFile({ fileType, fileName })
  ) {
    try {
      const pdf = await buildDeliverablePdf({
        fileBytes,
        envelope,
        watermark,
        pageOptions: await signaturePageOptions(
          envelope,
          t,
          locale,
          padesActive,
        ),
        pades: padesActive ? pades : null,
      });
      downloadBytes(
        pdf,
        signedPdfName(fileName, isFullySigned(envelope)),
        'application/pdf',
      );
      deliveredPdf = true;
    } catch (err) {
      // A PAdES failure must surface instead of silently delivering an unsigned PDF.
      if (padesActive) {
        onPadesError?.(err);
        return;
      }
    }
  }

  if (outputs.includes('detached') || !deliveredPdf) {
    downloadCertificate(envelope);
  }
}
