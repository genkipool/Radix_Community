import { NextResponse } from 'next/server';
import { getValidatorsCached } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));

    try {
        const { validators, networkStats } = await getValidatorsCached(network);
        
        if (validators.length === 0) {
            logger.warn({ network }, 'SERVED EMPTY VALIDATORS');
            return NextResponse.json(
                { validators: [], networkStats: null },
                { headers: { 'Cache-Control': 'no-store, max-age=0' } }
            );
        }

        logger.info({ 
            network, 
            count: validators.length,
            epoch: networkStats?.epoch 
        }, 'Serving validators data');

        return NextResponse.json(
            { validators, networkStats },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
                },
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Validators API error: %s', message);
        return NextResponse.json(
            { validators: [], networkStats: null, error: message },
            { 
                status: 200, // Return 200 to avoid breaking UI, but NO CACHE
                headers: { 'Cache-Control': 'no-store, max-age=0' } 
            },
        );
    }
}
