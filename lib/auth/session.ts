import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionJWT, type SessionPayload } from './sessionToken';

/**
 * Wallet session helpers for Server Components and Route Handlers.
 *
 * The token itself (signing, verifying, cookie, renewal) lives in
 * `sessionToken.ts`, which the proxy can import without `next/headers`.
 */

export {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  createSessionJWT,
  verifySessionJWT,
  renewSessionToken,
  buildSessionCookieHeader,
  buildClearSessionCookieHeader,
  type SessionAccount,
  type NetworkSessionData,
  type SessionPayload,
} from './sessionToken';

/**
 * Read and verify the session from the incoming request cookies.
 * For use in Server Components / Route Handlers.
 */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifySessionJWT(raw);
}
