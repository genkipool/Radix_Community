import { NextResponse } from 'next/server';
import { getXrdDailyPrices } from '@/services/xrdHistoricalPrices';
import logger from '@/lib/logger';

/**
 * Shared by every account and every year, ~19 KB gzipped, zero Redis reads:
 * cached aggressively at the CDN and in the browser.
 */
const CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400',
};

export async function GET() {
    try {
        const payload = await getXrdDailyPrices();
        return NextResponse.json(payload, { headers: CACHE_HEADERS });
    } catch (err) {
        logger.error({ err }, '[XrdDailyPrices] Error serving daily prices');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
