/**
 * Where a validator's logo is read from.
 *
 * Not from the operator's own host: through this app, which serves the same
 * bytes with an immutable cache header and lets Next resize them (see the
 * route for why, and for what stops it being an open proxy).
 *
 * The address is encoded into the PATH, not a query string: Next's image
 * optimiser refuses a local source that carries one, and this is the source it
 * is asked to optimise.
 */
import type { Network } from '@/features/dashboard/types';

/** base64url, the same on the server and in the browser. */
function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Reads back what {@link validatorIconSrc} encoded, or null if it is not ours. */
export function decodeIconToken(token: string): string | null {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const decoded =
      typeof atob === 'function'
        ? Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        : Buffer.from(base64, 'base64');
    const url = new TextDecoder().decode(decoded).trim();
    return url.startsWith('https://') ? url : null;
  } catch {
    return null;
  }
}

export function validatorIconSrc(
  iconUrl: string | undefined,
  network: Network = 'mainnet',
): string | undefined {
  const url = iconUrl?.trim();
  if (!url) return undefined;
  // A logo that is not an https URL is left exactly as it is: a data URL is
  // already the image, and there is nothing to fetch or shrink.
  if (!url.startsWith('https://')) return url;
  return `/api/validator-icon/${network}/${encodeBase64Url(url)}`;
}
