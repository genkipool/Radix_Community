import { NextResponse, type NextRequest } from 'next/server';
import { enforceSignRateLimit } from '@/features/sign/lib/rate-limit.server';
import {
  domainVerifyInputSchema,
  verifyIssuerDomain,
} from '@/features/sign/lib/domain-verify.server';

/**
 * POST /api/sign/domain-verify
 *
 * Thin stateless HTTP adapter over `verifyIssuerDomain`. Checks whether an
 * issuer's public domain publishes a matching Radix Seal declaration via
 * `/.well-known/radix-seal.json` or DNS TXT `_radix-seal.<domain>`.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceSignRateLimit(req);
  if (limited) return limited;

  const parsed = domainVerifyInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const result = await verifyIssuerDomain(parsed.data);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
