import { MAX_FILE_BYTES } from '../constants/limits';

/** Reads a File into memory with a hard size cap. Throws 'too_large'. */
export async function readFileBytes(file: File): Promise<Uint8Array> {
  if (file.size > MAX_FILE_BYTES) throw new Error('too_large');
  return new Uint8Array(await file.arrayBuffer());
}

export function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

/** Strips a trailing extension: `report.pdf` → `report`. */
export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Any suffix this feature appends, however many times it was appended. */
const OWN_SUFFIXES = /(?:[-_](?:signed|request))+$/i;

/**
 * Name for a delivered PDF.
 *
 * `-signed` means "nobody else has to sign this", so it is added only once the
 * certificate is complete, and any suffix the incoming file already carries is
 * stripped first. Both halves matter: a multi-party document travels from
 * signer to signer as a PDF, and appending on every hand-off produced
 * `contrato-signed-signed-signed.pdf` — one word per signer, none of which said
 * anything true until the last.
 *
 * A partially signed file therefore keeps the document's own name; what it
 * still needs is written inside it, on the certificate page.
 */
export function signedPdfName(fileName: string, complete: boolean): string {
  const base = stripExtension(fileName).replace(OWN_SUFFIXES, '');
  return `${base || stripExtension(fileName)}${complete ? '-signed' : ''}.pdf`;
}

/** Name for the PDF that carries an on-ledger signing request (never signed). */
export function requestPdfName(fileName: string): string {
  const base = stripExtension(fileName).replace(OWN_SUFFIXES, '');
  return `${base || stripExtension(fileName)}-request.pdf`;
}
