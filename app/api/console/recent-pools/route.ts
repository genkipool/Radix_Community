import { NextResponse } from 'next/server';

import { RECENT_POOLS_TTL_S, getRecentPoolsCached } from '@/services/gateway/recentPools';
import { validateNetwork } from '@/utils/apiValidation';

/**
 * Pools with recent contributions or redemptions on the network, for the
 * console's pickers ("Recent activity"), as [address, name] rows. Cached on
 * the server and the CDN for 5 minutes, so the popup gets it in one fast
 * request instead of chaining four Gateway reads from the browser.
 */
export async function GET(request: Request) {
  const network = validateNetwork(new URL(request.url).searchParams.get('network'));
  try {
    const pools = await getRecentPoolsCached(network);
    return NextResponse.json(
      { pools: pools.map((p) => [p.address, p.name]) },
      { headers: { 'Cache-Control': `public, max-age=60, s-maxage=${RECENT_POOLS_TTL_S}, stale-while-revalidate=3600` } },
    );
  } catch {
    return NextResponse.json({ pools: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
