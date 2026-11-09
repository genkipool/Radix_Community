import { NextResponse } from 'next/server';
import { candidateYears, getAccountRewardsYearData, getValidatorFeesYearData } from '@/services/accountRewards';
import logger from '@/lib/logger';

/**
 * Shared by every account and fresh enough for a day: the CDN answers most
 * requests, and the browser keeps it for an hour, so the Rewards tab of other
 * accounts, or of the same one opened again, downloads it only once.
 */
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' };

/**
 * GET /api/account-rewards-data?year=YYYY
 * GET /api/account-rewards-data?year=YYYY&fees=validator_rdx1…,validator_rdx1…
 *
 * With `fees`: only the daily fee of those validators (at most 10), what
 * their owner earned, for the account that holds their owner badge. Read from
 * the same value, so it costs Redis nothing more.
 *
 * One year of every validator's delegator rewards and daily stake, which the
 * browser combines with an account's history to work out its rewards CSV.
 * Only the years Redis can hold are accepted, so no query reaches Redis for
 * a key that cannot exist; the read itself is bounded per instance and hour
 * (services/accountRewards.ts).
 */
const MAX_FEE_VALIDATORS = 10;
const VALIDATOR_RE = /^validator_(rdx|tdx_2_)1[0-9a-z]{20,90}$/;

export async function GET(request: Request) {
    const params = new URL(request.url).searchParams;
    const year = params.get('year');
    if (!year || !candidateYears().includes(year)) {
        return NextResponse.json({ error: 'Unknown year' }, { status: 400 });
    }
    const feesParam = params.get('fees');
    if (feesParam !== null) {
        const validators = [...new Set(feesParam.split(','))];
        if (validators.length === 0 || validators.length > MAX_FEE_VALIDATORS || !validators.every((v) => VALIDATOR_RE.test(v))) {
            return NextResponse.json({ error: 'Invalid validators' }, { status: 400 });
        }
        try {
            const fees = await getValidatorFeesYearData(year, validators);
            if (!fees) return NextResponse.json({ error: 'No rewards data found' }, { status: 404, headers: CACHE_HEADERS });
            return NextResponse.json({ fees }, { headers: CACHE_HEADERS });
        } catch (error) {
            logger.error({ err: error, year }, '[AccountRewardsData] Error reading fees');
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    }

    try {
        const rewardsData = await getAccountRewardsYearData(year);
        if (!rewardsData) return NextResponse.json({ error: 'No rewards data found' }, { status: 404, headers: CACHE_HEADERS });
        return NextResponse.json({ rewardsData }, { headers: CACHE_HEADERS });
    } catch (error) {
        logger.error({ err: error, year }, '[AccountRewardsData] Error reading rewards');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
