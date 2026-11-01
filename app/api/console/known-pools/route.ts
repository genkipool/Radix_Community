import { NextResponse } from 'next/server';

import { KNOWN_POOLS_TTL_S, getKnownPoolsCached } from '@/services/gateway/knownPools';
import type { KnownPoolRow } from '@/features/console/lib/known-pools';
import { validateNetwork } from '@/utils/apiValidation';

/**
 * Native pools published by Ociswap, DefiPlaza and Reddicks (mainnet), for the console's
 * pool pickers. Proxied because DefiPlaza sends no CORS headers. The CDN keeps
 * the answer for 6 hours (and serves it stale for a day while it refreshes),
 * so the upstream pages are read a few times a day, not on every popup.
 */
export async function GET(request: Request) {
  const network = validateNetwork(new URL(request.url).searchParams.get('network'));
  try {
    const pools = await getKnownPoolsCached(network);
    const rows: KnownPoolRow[] = pools.map((p) => [p.address, p.name, p.source]);
    return NextResponse.json(
      { pools: rows },
      { headers: { 'Cache-Control': `public, max-age=3600, s-maxage=${KNOWN_POOLS_TTL_S}, stale-while-revalidate=86400` } },
    );
  } catch {
    return NextResponse.json({ pools: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
