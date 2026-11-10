import { NextResponse } from 'next/server';
import { getTokenPrices } from '@/services/tokenPrices';

/**
 * GET /api/token-prices
 *
 * The price in XRD of every Radix mainnet token the sources list, and XRD in
 * USD and EUR (services/tokenPrices). Takes no parameters: every visitor gets
 * the same answer, cached a minute by the CDN and the browser and a minute in
 * the instance's memory, so the sources are asked at most once a minute
 * whatever the traffic, and it costs Redis nothing beyond the XRD price the
 * dashboard already reads.
 */
export async function GET() {
    const prices = await getTokenPrices();
    if (!prices) {
        return NextResponse.json({ error: 'prices_unavailable' }, {
            status: 503,
            headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30', 'X-Content-Type-Options': 'nosniff' },
        });
    }
    return NextResponse.json(prices, {
        headers: {
            'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300, stale-if-error=3600',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
