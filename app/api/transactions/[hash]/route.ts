import { NextRequest, NextResponse } from 'next/server';
import { fetchTransactionDetails } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateTxHash, validateNetwork } from '@/utils/apiValidation';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ hash: string }> }
) {
    const { hash: rawHash } = await params;
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));
    const hash = validateTxHash(rawHash);
    if (!hash) return NextResponse.json(null, { status: 400 });

    try {
        const details = await fetchTransactionDetails(hash, network);
        
        return NextResponse.json(details, {
            headers: {
                // Maximum protection: 1 day fresh, 1 day stale-while-revalidate
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Transaction details API error: %s', message);
        return NextResponse.json(null, { status: 500 });
    }
}
