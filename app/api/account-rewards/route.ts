import { NextResponse, type NextRequest } from 'next/server';
import { getAvailableYearsForAccount } from '@/services/accountRewards';
import logger from '@/lib/logger';

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

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use: years' },
                    { status: 400 },
                );
        }
    } catch (err) {
        logger.error({ err, address, action }, '[AccountRewardsAPI] Error');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
