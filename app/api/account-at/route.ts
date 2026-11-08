import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rateLimit';
import logger from '@/lib/logger';
import { validateAddress, validateNetwork } from '@/utils/apiValidation';
import { dayIsReadable, readAccountAtDay } from '@/services/gateway/accountAt';

/**
 * GET /api/account-at?address=account_…&day=YYYY-MM-DD&network=mainnet
 *
 * A Babylon account at the end of a UTC day: its holdings as the account card
 * reads them, and its stakes valued at that moment. A past day never changes,
 * so it is cached for long; today is still moving.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const network = validateNetwork(searchParams.get('network'));
    const address = validateAddress(searchParams.get('address'));
    const day = searchParams.get('day') ?? '';
    if (!address || !address.startsWith('account_')) return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    if (!dayIsReadable(day)) return NextResponse.json({ error: 'invalid_day' }, { status: 400 });

    const rate = await rateLimit(RATE_LIMITS.accountAt, clientIp(request.headers));
    if (!rate.allowed) return tooManyRequests(rate) as NextResponse;

    try {
        const body = await readAccountAtDay(address, day, network);
        const past = day < new Date().toISOString().slice(0, 10);
        const cache = past ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' : 'public, s-maxage=60';
        return NextResponse.json(body, { headers: { 'Cache-Control': cache } });
    } catch (err) {
        logger.error({ err, address, day }, '[account-at] read failed');
        return NextResponse.json({ error: 'gateway_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } });
    }
}
