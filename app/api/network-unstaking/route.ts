import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';
import { readNetworkUnstaking, refreshNetworkUnstaking } from '@/services/gateway/networkUnstaking';

/**
 * GET /api/network-unstaking?network=mainnet
 *
 * The XRD the network has waiting to be withdrawn from staking, with a week of
 * hourly samples. Served from what Redis holds: the Gateway is never asked on a
 * visitor's behalf. When the figure is old a refresh runs after the response
 * (one at a time, guarded by a lock), and the CDN keeps the answer for a minute.
 */
export async function GET(request: NextRequest) {
    const network = validateNetwork(request.nextUrl.searchParams.get('network'));
    try {
        const { wantsRefresh, ...data } = await readNetworkUnstaking(network);
        if (wantsRefresh) after(() => refreshNetworkUnstaking(network));
        return NextResponse.json(data, {
            headers: {
                'Cache-Control': wantsRefresh
                    ? 'public, s-maxage=15, stale-while-revalidate=30'
                    : 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error, network }, 'Network unstaking API error: %s', message);
        return NextResponse.json({ error: 'unavailable' }, {
            status: 503,
            headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' },
        });
    }
}
