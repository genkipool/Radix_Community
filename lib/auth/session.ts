import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

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

const COOKIE_NAME = 'radix-session';
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Lazily encode the JWT secret. Throws at call-time if missing,
 * so the module can still be imported safely in edge/build.
 */
function getSecret(): Uint8Array {
  const raw = process.env.SUPABASE_JWT_SECRET;
  if (!raw) {
    throw new Error('SUPABASE_JWT_SECRET is not set');
  }
  return new TextEncoder().encode(raw);
}

// ─── JWT Helpers ────────────────────────────────────────────────────────────────

/**
 * Sign a session payload into a compact JWT string (30-day expiry).
 */
export async function createSessionJWT(
  payload: Pick<SessionPayload, 'mainnet' | 'stokenet'>,
): Promise<string> {
  return new SignJWT({ mainnet: payload.mainnet, stokenet: payload.stokenet })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

/**
 * Verify and decode a JWT token. Returns `null` on any failure.
 */
export async function verifySessionJWT(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Cookie Helpers ─────────────────────────────────────────────────────────────

/**
 * Read and verify the session from the incoming request cookies.
 * For use in Server Components / Route Handlers.
 */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifySessionJWT(raw);
}

/**
 * Build a `Set-Cookie` header value for the session JWT.
 */
export function buildSessionCookieHeader(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${token}`,
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
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}
