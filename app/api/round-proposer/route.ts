import { NextRequest, NextResponse } from 'next/server';
import { fetchRoundProposer } from '@/services/radixApi';
import { unstable_cache } from 'next/cache';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';

/**
 * A committed round's proposer is immutable — cache for 24 h.
 * The cache key includes epoch, round, stateVersion and network.
 */
const fetchCachedRoundProposer = (
    epoch: number,
    round: number,
    stateVersion: number,
    network: 'mainnet' | 'stokenet',
) =>
    unstable_cache(
        async () => {
            const proposer = await fetchRoundProposer(epoch, round, stateVersion, network);
            if (!proposer) {
                throw new Error(`Round proposer not available for ${epoch}:${round}`);
            }
            return proposer;
        },
        [`round-proposer-${network}-${epoch}-${round}-${stateVersion}`],
        { revalidate: 86400, tags: ['round-proposer'] },
    )();

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const epoch        = parseInt(searchParams.get('epoch')        || '0', 10);
    const round        = parseInt(searchParams.get('round')        || '0', 10);
    const stateVersion = parseInt(searchParams.get('stateVersion') || '0', 10);
    const network      = validateNetwork(searchParams.get('network'));

    if (!epoch || !round || !stateVersion) {
        return NextResponse.json(null, { status: 400 });
    }

    try {
        const proposer = await fetchCachedRoundProposer(epoch, round, stateVersion, network);
        
        if (!proposer) {
             return NextResponse.json(null, {
                headers: { 'Cache-Control': 'no-store, max-age=0' },
            });
        }

        return NextResponse.json(proposer, {
            headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Round proposer API error: %s', message);
        return NextResponse.json(null, { 
            status: 200, 
            headers: { 'Cache-Control': 'no-store, max-age=0' }
        });
    }
}
