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
