import { NextResponse } from 'next/server';

import { KNOWN_TOKENS_TTL_S, getKnownTokensCached } from '@/services/gateway/knownTokens';
import { validateNetwork } from '@/utils/apiValidation';

/**
 * Symbol → genuine token address, from the DEXes (mainnet), for the pool info
 * impersonation check. Proxied because DefiPlaza sends no CORS headers; the
 * CDN keeps the answer for 6 hours and serves it stale for a day.
 */
export async function GET(request: Request) {
  const network = validateNetwork(new URL(request.url).searchParams.get('network'));
  try {
    const tokens = await getKnownTokensCached(network);
    return NextResponse.json(
      { tokens },
      { headers: { 'Cache-Control': `public, max-age=3600, s-maxage=${KNOWN_TOKENS_TTL_S}, stale-while-revalidate=86400` } },
    );
  } catch {
    return NextResponse.json({ tokens: {} }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
