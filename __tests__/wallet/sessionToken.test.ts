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
    expect(await renewSessionToken(await createSessionJWT(session))).toBeNull();
  });

  it('re-issues a token from before sessions had an issuer, whatever its age', async () => {
    const renewed = await renewSessionToken(await tokenIssued(0.5, 180));
    expect(decodeJwt(renewed!)).toMatchObject({ iss: 'radix-community', aud: 'radix-community:session' });
  });

  it('never renews what is not a live session', async () => {
    expect(await renewSessionToken('not-a-token')).toBeNull();
    expect(await renewSessionToken(await tokenIssued(40, 30))).toBeNull(); // expired
    expect(await renewSessionToken(await tokenIssued(3, 180, { mainnet: null, stokenet: null }))).toBeNull();
  });
});

describe('verifySessionJWT', () => {
  const sign = (payload: object, header: { alg: string } = { alg: 'HS256' }) =>
    new SignJWT({ ...payload })
      .setProtectedHeader(header)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));

  it('accepts the sessions it signs', async () => {
    expect(await verifySessionJWT(await createSessionJWT(session))).toMatchObject(session);
  });

  it('refuses a token signed with the same key for something else, as Supabase signs its own', async () => {
    const supabaseLike = await new SignJWT({ role: 'anon', mainnet: null, stokenet: null })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('supabase')
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionJWT(supabaseLike)).toBeNull();
    expect(await verifySessionJWT(await sign({ role: 'anon', iss: 'supabase' }))).toBeNull();
  });

  it('refuses a token without the shape of a session', async () => {
    expect(await verifySessionJWT(await sign({ sub: 'someone' }))).toBeNull();
  });

  it('refuses another issuer or audience', async () => {
    const other = await new SignJWT({ ...session })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('elsewhere')
      .setAudience('radix-community:session')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionJWT(other)).toBeNull();
  });

  it('refuses any algorithm but HS256', async () => {
    expect(await verifySessionJWT(await sign(session, { alg: 'HS512' }))).toBeNull();
  });
});
