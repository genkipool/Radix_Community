import { NextResponse } from 'next/server';
import { fetchValidatorsWithLedger, computeNetworkStats } from '@/services/radixApi';
import { unstable_cache } from 'next/cache';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';

// Cache validator data — revalidates every 300 s
const fetchCachedValidators = (network: 'mainnet' | 'stokenet') =>
    unstable_cache(
        async () => {
            const { validators, ledgerState } = await fetchValidatorsWithLedger(network);
            
            // SECURITY: If the Gateway returns 0 validators on a live network, 
            // it's likely a sync issue. Throw to prevent caching this state.
            if (validators.length === 0) {
                throw new Error('Gateway returned empty validator set');
            }

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
        { revalidate: 300, tags: ['validators', `validators-${network}`] },
    )();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));

    try {
        const { validators, networkStats } = await fetchCachedValidators(network);
        
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
