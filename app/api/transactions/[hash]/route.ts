import { NextRequest, NextResponse } from 'next/server';
import { fetchTransactionDetails } from '@/services/radixApi';
import { unstable_cache } from 'next/cache';
import logger from '@/lib/logger';
import { validateTxHash, validateNetwork } from '@/utils/apiValidation';

/**
 * Transaction details are immutable once committed — cache for 24 h.
 * Cache key is derived from hash + network.
 */
const fetchCachedTransactionDetails = (
    hash: string,
    network: 'mainnet' | 'stokenet',
) =>
    unstable_cache(
        async () => fetchTransactionDetails(hash, network),
        [`tx-detail-${network}-${hash}`],
        { revalidate: 86400, tags: ['transaction-detail', `tx-${network}`] },
    )();

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
        const details = await fetchCachedTransactionDetails(hash, network);
        return NextResponse.json(details, {
            headers: {
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Transaction details API error: %s', message);
        return NextResponse.json(null, { status: 500 });
    }
}
