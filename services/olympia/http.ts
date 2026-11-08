/**
 * services/olympia/http.ts
 *
 * What every `/api/olympia/*` route shares: parameter parsing, the account a
 * request is about (by Olympia or Babylon address), long caching (Olympia's
 * data is final) and one error shape.
 */
import 'server-only';
import { RATE_LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rateLimit';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { olympiaKindOf } from '@/features/dashboard/lib/olympia';
import { OLYMPIA_FINAL_STATE_VERSION } from '@/features/dashboard/lib/olympia';
import { findAccountByBabylon, findAccountByOlympia, type OlympiaAccountRef } from './accounts';
import { versionAtDayEnd } from './history';

/** Final data: a day at the edge, a week stale while it refreshes. */
const CACHE_FINAL = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800';

export const babylonAccountSchema = z.string().regex(/^account_rdx1[02-9ac-hj-np-z]{40,80}$/);
export const olympiaAccountSchema = z.string().refine((v) => olympiaKindOf(v) === 'account');
export const accountParamSchema = z.union([olympiaAccountSchema, babylonAccountSchema]);
export const validatorParamSchema = z.string().refine((v) => olympiaKindOf(v) === 'validator');
export const txIdSchema = z.string().regex(/^[0-9a-fA-F]{64}$/);
export const yearSchema = z.coerce.number().int().min(2021).max(2023);

/**
 * A point of Olympia: a state version (1 to the last) or a UTC day YYYY-MM-DD
 * of Olympia, read at its last state version.
 */
export const olympiaAtSchema = z.string().max(12).transform((v, ctx) => {
  if (/^\d{1,9}$/.test(v)) {
    const n = Number(v);
    if (n >= 1 && n <= OLYMPIA_FINAL_STATE_VERSION) return { stateVersion: n, day: null as string | null };
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const sv = versionAtDayEnd(v);
    if (sv !== null) return { stateVersion: sv, day: v as string | null };
  }
  ctx.addIssue({ code: 'custom', message: 'Expected a state version or a day of Olympia (YYYY-MM-DD)' });
  return z.NEVER;
});

export function ok(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: { 'Cache-Control': CACHE_FINAL } });
}

export function fail(status: 400 | 404 | 503, error: string): NextResponse {
  const headers: Record<string, string> = status === 503
    ? { 'Cache-Control': 'no-store', 'Retry-After': '5' }
    // "Not on Olympia" is as final as the data itself.
    : status === 404 ? { 'Cache-Control': CACHE_FINAL } : { 'Cache-Control': 'no-store' };
  return NextResponse.json({ error }, { status, headers });
}

/** The account a request names, by its Olympia address or the Babylon account it became. */
export async function accountOf(value: string): Promise<OlympiaAccountRef | null> {
  return value.startsWith('account_') ? findAccountByBabylon(value) : findAccountByOlympia(value);
}

/**
 * Runs a route body with the shared rate limit and error handling: a dataset
 * that cannot be reached answers 503 (retryable), never a misleading 404.
 */
export async function handle(request: Request, route: string, run: () => Promise<NextResponse>): Promise<NextResponse> {
  // Every archive read is a few HTTP range requests to the dataset host; the
  // CDN absorbs repeats, this bounds what one address can make it do.
  const rate = await rateLimit(RATE_LIMITS.olympia, clientIp(request.headers));
  if (!rate.allowed) return tooManyRequests(rate) as NextResponse;
  try {
    return await run();
  } catch (err) {
    logger.error({ err, route }, '[olympia] dataset read failed');
    return fail(503, 'olympia_unavailable');
  }
}
