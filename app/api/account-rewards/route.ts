import { NextResponse, type NextRequest } from 'next/server';
import {
    getAvailableYearsForAccount,
    generateAccountRewardsCsv,
} from '@/services/accountRewards';
import logger from '@/lib/logger';

/**
 * Account rewards CSV generation can take several minutes due to Gateway API calls.
 * Set a generous timeout (5 minutes).
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const address = searchParams.get('address');
    const action = searchParams.get('action');

    if (!address || !address.startsWith('account_rdx')) {
        return NextResponse.json(
            { error: 'Missing or invalid account address' },
            { status: 400 },
        );
    }

    try {
        switch (action) {
            case 'years': {
                const years = await getAvailableYearsForAccount(address);
                return NextResponse.json({ years });
            }

            case 'csv': {
                const year = searchParams.get('year');
                if (!year || !/^\d{4}$/.test(year)) {
                    return NextResponse.json(
                        { error: 'Missing or invalid year parameter' },
                        { status: 400 },
                    );
                }

                const data = await generateAccountRewardsCsv(address, year);
                if (!data) {
                    return NextResponse.json(
                        { error: 'No reward data available for this account/year' },
                        { status: 404 },
                    );
                }

                return NextResponse.json({
                    csv: data.csv,
                    totalXrd: data.totalXrd
                });
            }

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use: years, csv' },
                    { status: 400 },
                );
        }
    } catch (err) {
        logger.error({ err, address, action }, '[AccountRewardsAPI] Error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
