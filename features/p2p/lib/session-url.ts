/**
 * Share URLs for P2P sessions: `<current tool path>#<params>`. Session params
 * live in the URL FRAGMENT so they never reach server logs and are not
 * forwarded by link-preview bots; the tool reads them client-side and
 * immediately strips them from the address bar.
 */

/** 128-bit random room id — the sole capability needed to join a session. */
export function randomRoomId(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isRoomId(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value);
}

/** Builds a share URL for the CURRENT page with the params in the fragment. */
export function buildShareUrl(params: Record<string, string>): string {
  const fragment = new URLSearchParams(params).toString();
  return `${window.location.origin}${window.location.pathname}#${fragment}`;
}

export function parseShareHash(hash: string): URLSearchParams {
  return new URLSearchParams(hash.replace(/^#/, ''));
}
