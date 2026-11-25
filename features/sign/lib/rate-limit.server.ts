/**
 * Shared server-side rate-limit guard for every `/api/sign/*` route.
 * Single source of truth so every Radix Seal endpoint enforces the same
 * `RATE_LIMITS.sign` policy and `429 Retry-After` contract.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { RATE_LIMITS, clientIp, rateLimit } from '@/lib/rateLimit';

/** Returns a 429 response when rate-limited, or `null` when allowed. */
export async function enforceSignRateLimit(
  req: NextRequest,
): Promise<NextResponse | null> {
  const rl = await rateLimit(RATE_LIMITS.sign, clientIp(req.headers));
  if (rl.allowed) return null;
  return NextResponse.json(
    { error: 'rate_limited' },
    { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
  );
}
