import { NextResponse } from 'next/server';
import { fetchValidatorsWithLedger, computeNetworkStats } from '@/services/radixApi';
import { unstable_cache } from 'next/cache';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';

// Cache validator data — revalidates every 60 s
const fetchCachedValidators = (network: 'mainnet' | 'stokenet') =>
    unstable_cache(
        async () => {
            const { validators, ledgerState } = await fetchValidatorsWithLedger(network);
            return {
                validators,
                networkStats: computeNetworkStats(
                    validators,
                    ledgerState.epoch,
                    ledgerState.state_version,
                    ledgerState.round,
                    ledgerState.proposer_round_timestamp,
                ),
            };
        },
        [`validators-${network}`],
        { revalidate: 3600, tags: ['validators', `validators-${network}`] },
    )();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));

    try {
        const { validators, networkStats } = await fetchCachedValidators(network);
        
        logger.info({ 
            network, 
            count: validators.length,
            epoch: networkStats?.epoch 
        }, 'Serving validators data');

        return NextResponse.json(
            { validators, networkStats },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                },
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Validators API error: %s', message);
        return NextResponse.json(
            { validators: [], networkStats: null, error: message },
            { status: 500 },
        );
    }
}
