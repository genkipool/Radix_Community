/**
 * Query parameters for a console tool (`?pool=…`, `?validator=…`).
 *
 * The console draws a tool on the click, before the router has moved the URL
 * (see ConsoleShell), so a tool reading `window.location` while it mounts
 * would still see the previous page's query. The shell records the query it
 * is about to navigate to, together with the URL it is leaving; while the
 * browser is still on that URL, that recorded query is the one that counts.
 * Once the URL moves (or on back / forward, which move it first) the real
 * URL is read again.
 */

let pending: { from: string; query: URLSearchParams } | null = null;

/** Called by the shell right before it navigates to a tool. */
export function setPendingConsoleQuery(query: string) {
  pending = typeof window === 'undefined' ? null : { from: window.location.href, query: new URLSearchParams(query) };
}

/** A query parameter of the tool being opened, or null. */
export function consoleQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  if (pending && pending.from === window.location.href) return pending.query.get(name);
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * `?account=…`: the account a link was opened with (a shortcut from an info
 * view passes the one picked there), or null to let the picker choose.
 */
export function accountFromQuery(): string | null {
  const account = consoleQueryParam('account');
  return account?.startsWith('account_') ? account : null;
}

/** `{ pool: 'pool_…', account: null }` → `pool=pool_…`: empty values are left out. */
export function toolQuery(params: Record<string, string | null | undefined>): string {
  return Object.entries(params)
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
}
