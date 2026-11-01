import { NextResponse, type NextRequest } from 'next/server';
import { createChallenge } from '@/lib/auth/challenges';
import { RATE_LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rateLimit';

/**
 * POST /api/auth/radix/challenge
 *
 * Generates a one-time ROLA challenge and stores it in Supabase
 * (replaces the in-memory Map that was lost across serverless invocations).
 */
export async function POST(req: NextRequest) {
  const rate = await rateLimit(RATE_LIMITS.auth, clientIp(req.headers));
  if (!rate.allowed) return tooManyRequests(rate);

  const challenge = await createChallenge();
  if (!challenge) {
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 },
    );
  }

  return NextResponse.json({ challenge });
}
