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
 * Lazily encode the JWT secret. Throws at call-time if missing,
 * so the module can still be imported safely in edge/build.
 *
 * `SESSION_JWT_SECRET` is the session's own key. Until it is set, the
 * Supabase JWT secret is used as before; Supabase signs its own tokens with
 * that key, which is why a session must also carry this site's issuer,
 * audience and shape (see `verifySessionJWT`).
 */
function getSecret(): Uint8Array {
  const raw = process.env.SESSION_JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!raw) {
    throw new Error('SESSION_JWT_SECRET is not set');
  }
  return new TextEncoder().encode(raw);
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
    .sign(getSecret());
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
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const legacy = payload.iss === undefined && payload.aud === undefined;
    if (!legacy && (payload.iss !== SESSION_ISSUER || payload.aud !== SESSION_AUDIENCE)) return null;
    return isSessionPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

/**
 * The same session signed again for another `SESSION_DURATION_SECONDS`, or
 * null when there is nothing to renew: an invalid or expired token, a session
 * with no network left, or one already renewed in the last day.
 *
 * Tokens issued before the duration went from 30 days to six months are valid
 * sessions like any other, so their first renewal carries them to six months.
 */
export async function renewSessionToken(
  token: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  const session = await verifySessionJWT(token);
  if (!session || (!session.mainnet && !session.stokenet)) return null;

  const issuedAt = typeof session.iat === 'number' ? session.iat : 0;
  const legacy = session.iss === undefined;
  if (!legacy && nowSeconds - issuedAt < SESSION_RENEW_AFTER_SECONDS) return null;

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
