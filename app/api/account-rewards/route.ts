import { NextResponse, type NextRequest } from 'next/server';
import { getAvailableRewardYears } from '@/services/accountRewards';
import logger from '@/lib/logger';

/**
 * GET /api/account-rewards?address=account_rdx…&action=years
 *
 * The years an account rewards CSV can be worked out for. The answer does not
 * depend on the account (it is the years with validator data), so it is
 * cached by the CDN and, behind it, read from Redis at most once per instance
 * and hour. The address is still required, to keep the old contract.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const address = searchParams.get('address');
    const action = searchParams.get('action');

    if (!address || !/^account_(rdx|tdx_2_)1[0-9a-z]{20,90}$/.test(address)) {
        return NextResponse.json({ error: 'Missing or invalid account address' }, { status: 400 });
    }
    if (action !== 'years') {
        return NextResponse.json({ error: 'Invalid action. Use: years' }, { status: 400 });
    }

    try {
        const years = await getAvailableRewardYears();
        return NextResponse.json({ years }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
    } catch (err) {
        logger.error({ err }, '[AccountRewardsAPI] Error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
