// @vitest-environment node
// jose needs Node's Uint8Array: under jsdom the key comes from another realm and is rejected.
import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, decodeJwt } from 'jose';

const SECRET = 'test-secret-for-session-tokens-0123456789';

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = SECRET;
});

import {
  SESSION_DURATION_SECONDS,
  buildSessionCookieHeader,
  createSessionJWT,
  renewSessionToken,
  verifySessionJWT,
} from '@/lib/auth/sessionToken';

const DAY = 24 * 60 * 60;
const now = () => Math.floor(Date.now() / 1000);

const session = {
  mainnet: { identityAddress: 'identity_rdx1abc', personaLabel: 'Genki', accounts: [] },
  stokenet: null,
};

/** A token as an older login would have left it: issued `ageDays` ago, valid for `lifetimeDays`. */
const tokenIssued = (ageDays: number, lifetimeDays: number, payload: object = session) => {
  const iat = now() - ageDays * DAY;
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(iat + lifetimeDays * DAY)
    .sign(new TextEncoder().encode(SECRET));
};

describe('session duration', () => {
  it('lasts six months, in the token and in the cookie', async () => {
    const token = await createSessionJWT(session);
    const { iat, exp } = decodeJwt(token);
    expect(SESSION_DURATION_SECONDS).toBe(180 * DAY);
    expect(exp! - iat!).toBe(180 * DAY);
    expect(buildSessionCookieHeader(token)).toContain(`Max-Age=${180 * DAY}`);
  });
});

describe('renewSessionToken', () => {
  it('signs a session in use again for another six months, keeping its content', async () => {
    const renewed = await renewSessionToken(await tokenIssued(3, 180));
    expect(renewed).not.toBeNull();
    const { exp } = decodeJwt(renewed!);
    expect(exp! - now()).toBeGreaterThan(179 * DAY);
    expect(await verifySessionJWT(renewed!)).toMatchObject({ mainnet: session.mainnet, stokenet: null });
  });

  it('carries a session from the 30-day era to six months on its first renewal', async () => {
    const renewed = await renewSessionToken(await tokenIssued(10, 30));
    expect(decodeJwt(renewed!).exp! - now()).toBeGreaterThan(179 * DAY);
  });

  it('does not re-sign a token renewed less than a day ago', async () => {
    expect(await renewSessionToken(await tokenIssued(0.5, 180))).toBeNull();
  });

  it('never renews what is not a live session', async () => {
    expect(await renewSessionToken('not-a-token')).toBeNull();
    expect(await renewSessionToken(await tokenIssued(40, 30))).toBeNull(); // expired
    expect(await renewSessionToken(await tokenIssued(3, 180, { mainnet: null, stokenet: null }))).toBeNull();
  });
});
