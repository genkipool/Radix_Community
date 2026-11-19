import { DAO_DOCUMENTS } from '../data/radixDaoData';
import type { DaoDocument } from '../types/radixDao.types';

const DOCUMENTS_BY_SHA256 = new Map<string, DaoDocument>(
  DAO_DOCUMENTS.map((doc) => [doc.sha256.toLowerCase(), doc])
);

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function findDocumentBySha256(hash: string): DaoDocument | undefined {
  return DOCUMENTS_BY_SHA256.get(hash.toLowerCase());
}
