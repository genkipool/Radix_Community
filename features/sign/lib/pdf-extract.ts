/**
 * Extracts Radix attachments (certificate + original document) from a signed
 * PDF. pdf-lib has no public attachment reader, so we walk the low-level
 * `/Root /Names /EmbeddedFiles` name tree ourselves. All lazy, browser-only.
 */
import type { AttestationEnvelope } from '../types/sign.types';
import {
  CERT_ATTACHMENT,
  ORIGINAL_ATTACHMENT_PREFIX,
  REQUEST_ATTACHMENT,
  type RequestPointer,
} from './pdf-embed';

export interface RadixAttachments {
  envelope: AttestationEnvelope | null;
  originalBytes: Uint8Array | null;
  originalName: string | null;
}

function looksLikeEnvelope(v: unknown): v is AttestationEnvelope {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  const payload = e.payload as Record<string, unknown> | undefined;
  return (
    typeof payload?.docHash === 'string' &&
    Array.isArray(payload?.signers) &&
    Array.isArray(e.signatures)
  );
}

/** Reads every embedded file as `{ name → bytes }`. Empty on any parse issue. */
async function readEmbeddedFiles(
  pdfBytes: Uint8Array,
): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  try {
    const pdfLib = await import('pdf-lib');
    const {
      PDFDocument,
      PDFName,
      PDFDict,
      PDFArray,
      PDFRawStream,
      decodePDFRawStream,
    } = pdfLib;

    const doc = await PDFDocument.load(pdfBytes, { throwOnInvalidObject: false });
    const names = doc.catalog.lookup(PDFName.of('Names'), PDFDict);
    const embeddedFiles = names?.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
    const nameArray = embeddedFiles?.lookup(PDFName.of('Names'), PDFArray);
    if (!nameArray) return out;

    for (let i = 0; i + 1 < nameArray.size(); i += 2) {
      const rawName = nameArray.lookup(i) as { decodeText?: () => string; asString?: () => string };
      const fileName = rawName?.decodeText?.() ?? rawName?.asString?.() ?? '';
      const spec = nameArray.lookup(i + 1, PDFDict);
      const ef = spec?.lookup(PDFName.of('EF'), PDFDict);
      const streamObj =
        ef?.lookup(PDFName.of('F')) ?? ef?.lookup(PDFName.of('UF'));
      const stream = streamObj instanceof PDFRawStream ? streamObj : null;
      if (!fileName || !stream) continue;
      try {
        out.set(fileName, decodePDFRawStream(stream).decode());
      } catch {
        /* skip unreadable stream */
      }
    }
  } catch {
    /* not a PDF, or unexpected structure — return whatever we have */
  }
  return out;
}

/**
 * Returns the certificate + original document embedded in a signed PDF (or
 * nulls when absent). Never throws.
 */
export async function extractRadixAttachments(
  pdfBytes: Uint8Array,
): Promise<RadixAttachments> {
  const files = await readEmbeddedFiles(pdfBytes);

  let envelope: AttestationEnvelope | null = null;
  const certBytes =
    files.get(CERT_ATTACHMENT) ??
    [...files].find(([name]) => name.endsWith('.radixsig.json'))?.[1];
  if (certBytes) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(certBytes));
      if (looksLikeEnvelope(parsed)) envelope = parsed;
    } catch {
      /* malformed certificate */
    }
  }

  const originalEntry = [...files].find(([name]) =>
    name.startsWith(ORIGINAL_ATTACHMENT_PREFIX),
  );
  const originalBytes = originalEntry?.[1] ?? null;
  const originalName =
    originalEntry?.[0].replace(`${ORIGINAL_ATTACHMENT_PREFIX}-`, '') ?? null;

  return { envelope, originalBytes, originalName };
}

/** The embedded request pointer + original document from a shared PDF. */
export interface EmbeddedRequest {
  pointer: RequestPointer;
  originalBytes: Uint8Array | null;
  originalName: string | null;
}

function looksLikePointer(v: unknown): v is RequestPointer {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    p.v === 1 &&
    typeof p.requestKey === 'string' &&
    typeof p.networkId === 'number' &&
    typeof p.docHash === 'string'
  );
}

/**
 * Returns the on-ledger request pointer embedded in a shared PDF (plus the
 * original document, when attached), or null. Never throws.
 */
export async function extractRequestPointer(
  pdfBytes: Uint8Array,
): Promise<EmbeddedRequest | null> {
  const files = await readEmbeddedFiles(pdfBytes);
  const pointerBytes = files.get(REQUEST_ATTACHMENT);
  if (!pointerBytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(pointerBytes));
    if (!looksLikePointer(parsed)) return null;
    const originalEntry = [...files].find(([name]) =>
      name.startsWith(ORIGINAL_ATTACHMENT_PREFIX),
    );
    return {
      pointer: parsed,
      originalBytes: originalEntry?.[1] ?? null,
      originalName:
        originalEntry?.[0].replace(`${ORIGINAL_ATTACHMENT_PREFIX}-`, '') ?? null,
    };
  } catch {
    return null;
  }
}

/** True when the file starts with the PDF magic. */
export function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}
