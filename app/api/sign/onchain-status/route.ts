import { NextResponse, type NextRequest } from 'next/server';
import { isSupportedNetworkId } from '@/features/sign/lib/network';
import { enforceSignRateLimit } from '@/features/sign/lib/rate-limit.server';
import {
  getOnChainRequestStatus,
  onChainStatusInputSchema,
} from '@/features/sign/lib/onchain-status.server';

/**
 * POST /api/sign/onchain-status
 *
 * Thin stateless HTTP adapter over `getOnChainRequestStatus`. Rate-limits,
 * validates input, and returns live on-ledger request status with `no-store`.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceSignRateLimit(req);
  if (limited) return limited;

  const parsed = onChainStatusInputSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (!isSupportedNetworkId(parsed.data.networkId)) {
    return NextResponse.json({ error: 'invalid_network' }, { status: 400 });
  }

  try {
    const result = await getOnChainRequestStatus(parsed.data);
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
