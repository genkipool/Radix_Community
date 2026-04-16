import { NextRequest, NextResponse } from 'next/server';
import { getRoundProposerCached } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';

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
        const proposer = await getRoundProposerCached(epoch, round, stateVersion, network);
        
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
