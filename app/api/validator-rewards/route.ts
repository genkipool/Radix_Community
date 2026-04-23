import { NextResponse, type NextRequest } from 'next/server';
import {
    getEpochRewardsForTable,
    getAvailableYears,
    generateRewardsCsv,
} from '@/services/validatorRewards';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const address = searchParams.get('address');
    const action = searchParams.get('action');

    if (!address || !address.startsWith('validator_rdx')) {
        return NextResponse.json(
            { error: 'Missing or invalid validator address' },
            { status: 400 },
        );
    }

    try {
        switch (action) {
            case 'epochs': {
                const rewards = await getEpochRewardsForTable(address);
                return NextResponse.json({ rewards });
            }

            case 'years': {
                const years = await getAvailableYears(address);
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

                const csv = await generateRewardsCsv(address, year);
                if (!csv) {
                    return NextResponse.json(
                        { error: 'No reward data available for this year' },
                        { status: 404 },
                    );
                }

                return new NextResponse(csv, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': `attachment; filename="radix_rewards_${address.substring(0, 20)}_${year}.csv"`,
                    },
                });
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
