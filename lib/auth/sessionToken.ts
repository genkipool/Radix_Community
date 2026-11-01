import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * The wallet session token: signing, verifying, its cookie and its renewal.
 *
 * Kept free of `next/headers` so the proxy can renew sessions on every page
 * request; `session.ts` adds the Server Component helpers on top.
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SessionAccount {
  address: string;
  label: string;
  appearanceId: number;
}

export interface NetworkSessionData {
  identityAddress: string;
  personaLabel: string;
  accounts: SessionAccount[];
}

export interface SessionPayload extends JWTPayload {
  mainnet: NetworkSessionData | null;
  stokenet: NetworkSessionData | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

export const SESSION_COOKIE_NAME = 'radix-session';

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Six months, counted from the last renewal, not from the login: a session in
 * use keeps being renewed (see `renewSessionToken`) and only one left unused
 * for this long runs out.
 */
export const SESSION_DURATION_SECONDS = 180 * DAY_SECONDS;

/**
 * A token is re-signed at most once a day. Renewing on every request would sign
 * a new token for each page view and gain nothing: a day is nothing against six
 * months.
 */
export const SESSION_RENEW_AFTER_SECONDS = DAY_SECONDS;

/** Who signs session tokens, and for what: a token signed for anything else is not a session. */
const SESSION_ISSUER = 'radix-community';
const SESSION_AUDIENCE = 'radix-community:session';

/**
 * The keys of session tokens, read lazily so the module can still be imported
 * safely in edge/build.
 *
 * `SESSION_JWT_SECRET` is the session's own key. Until it is set, the
 * Supabase JWT secret is used as before; Supabase signs its own tokens with
 * that key, which is why a session must also carry this site's issuer,
 * audience and shape (see `verifySessionJWT`).
 *
 * Once it is set, sessions signed with the Supabase key are still accepted and
 * signed again with the new one on their next request (see
 * `renewSessionToken`), so nobody has to log in again.
 */
function sessionKeys(): { signing: Uint8Array; verifying: Uint8Array[] } {
  const own = process.env.SESSION_JWT_SECRET;
  const supabase = process.env.SUPABASE_JWT_SECRET;
  const signing = own || supabase;
  if (!signing) {
    throw new Error('SESSION_JWT_SECRET is not set');
  }
  const encode = (raw: string) => new TextEncoder().encode(raw);
  const verifying = [signing, ...(own && supabase && supabase !== own ? [supabase] : [])];
  return { signing: encode(signing), verifying: verifying.map(encode) };
}

/** Whether a verified payload has the shape of a session, and nothing claims it is something else. */
function isSessionPayload(payload: JWTPayload): payload is SessionPayload {
  const isNetwork = (value: unknown) => value === null || (typeof value === 'object' && value !== null);
  return 'mainnet' in payload && 'stokenet' in payload
    && isNetwork(payload.mainnet) && isNetwork(payload.stokenet)
    && !('role' in payload);
}

// ─── JWT Helpers ────────────────────────────────────────────────────────────────

/**
 * Sign a session payload into a compact JWT string, valid for
 * `SESSION_DURATION_SECONDS` from now.
 */
export async function createSessionJWT(
  payload: Pick<SessionPayload, 'mainnet' | 'stokenet'>,
): Promise<string> {
  return new SignJWT({ mainnet: payload.mainnet, stokenet: payload.stokenet })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionKeys().signing);
}

/**
 * Verify and decode a JWT token. Returns `null` on any failure.
 *
 * Tokens issued before sessions carried an issuer and audience are still
 * accepted when they have a session's shape; renewal re-issues them with both
 * within a day of use, so they disappear as sessions are used.
 */
export async function verifySessionJWT(
  token: string,
): Promise<SessionPayload | null> {
  return (await readSession(token))?.session ?? null;
}

/** A valid session, and whether it is signed with the current key. */
async function readSession(
  token: string,
): Promise<{ session: SessionPayload; currentKey: boolean } | null> {
  const { verifying } = sessionKeys();
  for (const [index, key] of verifying.entries()) {
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      const legacy = payload.iss === undefined && payload.aud === undefined;
      if (!legacy && (payload.iss !== SESSION_ISSUER || payload.aud !== SESSION_AUDIENCE)) return null;
      return isSessionPayload(payload) ? { session: payload, currentKey: index === 0 } : null;
    } catch {
      // Not this key (or not valid at all): the next one, if any, decides.
    }
  }
  return null;
}

/**
 * The same session signed again for another `SESSION_DURATION_SECONDS`, or
 * null when there is nothing to renew: an invalid or expired token, a session
 * with no network left, or one already renewed in the last day.
 *
 * Tokens issued before the duration went from 30 days to six months are valid
 * sessions like any other, so their first renewal carries them to six months.
 * A token signed with the previous key, or from before sessions had an issuer,
 * is renewed at once, whatever its age.
 */
export async function renewSessionToken(
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  const read = await readSession(token);
  if (!read) return null;
  const { session, currentKey } = read;
  if (!session.mainnet && !session.stokenet) return null;

  const issuedAt = typeof session.iat === 'number' ? session.iat : 0;
  const outdated = !currentKey || session.iss === undefined;
  if (!outdated && nowSeconds - issuedAt < SESSION_RENEW_AFTER_SECONDS) return null;

  return createSessionJWT({ mainnet: session.mainnet, stokenet: session.stokenet });
}

// ─── Cookie Helpers ─────────────────────────────────────────────────────────────

/**
 * Build a `Set-Cookie` header value for the session JWT.
 */
export function buildSessionCookieHeader(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProduction) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Build a `Set-Cookie` header that clears the session cookie.
 */
export function buildClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
