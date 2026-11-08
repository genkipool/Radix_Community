import { NextResponse, type NextRequest } from 'next/server';
import {
    getEpochRewardsForTable,
    getAvailableYears,
    generateRewardsCsv,
} from '@/services/validatorRewards';
import logger from '@/lib/logger';
import { candidateYears } from '@/services/accountRewards';

/** Reward figures change once per epoch: the CDN answers repeats for a few minutes. */
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' };

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const address = searchParams.get('address');
    const action = searchParams.get('action');

    if (!address || !/^validator_(rdx|tdx_2_)1[0-9a-z]{20,90}$/.test(address)) {
        return NextResponse.json(
            { error: 'Missing or invalid validator address' },
            { status: 400 },
        );
    }

    try {
        switch (action) {
            case 'epochs': {
                const rewards = await getEpochRewardsForTable(address);
                return NextResponse.json({ rewards }, { headers: CACHE_HEADERS });
            }

            case 'years': {
                const years = await getAvailableYears(address);
                return NextResponse.json({ years }, { headers: CACHE_HEADERS });
            }

            case 'csv': {
                const year = searchParams.get('year');
                // Only the years the sync keeps: anything else would only cost a Redis read.
                if (!year || !candidateYears().includes(year)) {
                    return NextResponse.json(
                        { error: 'Missing or invalid year parameter' },
                        { status: 400 },
                    );
                }

                const data = await generateRewardsCsv(address, year);
                if (!data) {
                    return NextResponse.json(
                        { error: 'No reward data available for this year' },
                        { status: 404 },
                    );
                }

                return NextResponse.json({
                    csv: data.csv,
                    totalXrd: data.totalXrd
                }, { headers: CACHE_HEADERS });
            }

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use: epochs, years, csv' },
                    { status: 400 },
                );
        }
    } catch (err) {
        logger.error({ err, address, action }, '[ValidatorRewardsAPI] Error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
