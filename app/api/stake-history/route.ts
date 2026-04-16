import { NextRequest, NextResponse } from 'next/server';
import { fetchStakeHistoryCached } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateAddress, validateNetwork } from '@/utils/apiValidation';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const network = validateNetwork(searchParams.get('network'));
    const address = validateAddress(searchParams.get('address'));

    if (!address) {
        return NextResponse.json({ error: 'Missing validator address' }, { status: 400 });
    }

    try {
        const history = await fetchStakeHistoryCached(address, network);
        
        return NextResponse.json(history, {
            headers: {
                // Browser cache: 2 minutes
                // CDN/Server cache: 5 minutes
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Stake history API error: %s', message);
        return NextResponse.json(
            { error: message || 'Internal server error' },
            { 
                status: 200, // Stay on 200 for UI but NO CACHE
                headers: { 'Cache-Control': 'no-store, max-age=0' }
            }
        );
    }
}
