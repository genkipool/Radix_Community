import { NextResponse, type NextRequest } from 'next/server';
import { RATE_LIMITS, clientIp, rateLimit } from '@/lib/rateLimit';
import {
  auditSignCollection,
  collectionAuditInputSchema,
  networkMatchesCollection,
} from '@/features/sign/lib/collection-audit.server';

/**
 * POST /api/sign/collection-audit
 *
 * Thin stateless HTTP adapter over `auditSignCollection`. Rate-limits,
 * validates input + strict network isolation, and returns live ledger audit
 * results with `Cache-Control: no-store`.
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimit(RATE_LIMITS.sign, clientIp(req.headers));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const parsed = collectionAuditInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!networkMatchesCollection(parsed.data.networkId, parsed.data.collection)) {
    return NextResponse.json({ error: 'network_mismatch' }, { status: 400 });
  }

  try {
    const result = await auditSignCollection(parsed.data);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'internal_error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
