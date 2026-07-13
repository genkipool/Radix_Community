/** Small presentation helpers shared by the cipher UI. */

export { fillTemplate, shortAddress } from '@/utils/format';

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** First 8 hex chars of the header hash — the human-checkable fingerprint. */
export function shortFingerprint(hash: string): string {
  return hash.slice(0, 8);
}
