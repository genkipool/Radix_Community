import { NextResponse } from 'next/server';

import { DEX_LISTING_TTL_S, getDexListing } from '@/services/gateway/dexListings';
import { validateNetwork } from '@/utils/apiValidation';

/** Bech32m component or pool address, nothing around it. */
const ADDRESS = /^(component|pool)_(rdx|tdx_2_)1[02-9ac-hj-np-z]{40,90}$/;

/**
 * Whether a DEX lists a component or native pool, and the yield it reports,
 * for the console's DEX liquidity tools. Proxied because DefiPlaza sends no
 * CORS headers; the CDN keeps each answer for an hour.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const network = validateNetwork(params.get('network'));
  const address = params.get('address') ?? '';
  if (!ADDRESS.test(address)) return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  try {
    const listing = await getDexListing(network, address);
    return NextResponse.json(
      { listing },
      { headers: { 'Cache-Control': `public, max-age=300, s-maxage=${DEX_LISTING_TTL_S}, stale-while-revalidate=86400` } },
    );
  } catch {
    return NextResponse.json({ listing: null, error: 'DEX unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
