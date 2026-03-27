import { NextRequest, NextResponse } from 'next/server';
import { fetchEntityDetails } from '@/services/radixApi';
import { unstable_cache } from 'next/cache';
import logger from '@/lib/logger';
import { validateAddress, validateNetwork } from '@/utils/apiValidation';

/**
 * Cached entity details fetcher using unstable_cache.
 *
 * Why extract outside GET?
 *  • Cache key is derived from (addr, network) — both serializable args.
 *  • revalidate: 300 matches the old cacheLife('minutes', 5) behaviour.
 *
 * Bug fix: only cache successful (non-null) responses. A Gateway timeout
 * would otherwise cache null, returning stale null until revalidation.
 */
const fetchCachedEntityDetails = (
    addr: string,
    network: 'mainnet' | 'stokenet',
) =>
    unstable_cache(
        async () => {
            const details = await fetchEntityDetails(addr, network);
            if (!details) throw new Error('Empty entity response — do not cache');
            return details;
        },
        [`entity-${network}-${addr}`],
        { revalidate: 300, tags: ['entity', `entity-${network}`] },
    )();

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    const { address: rawAddress } = await params;
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));
    const address = validateAddress(rawAddress);
    if (!address) return NextResponse.json(null, { status: 400 });

    try {
        const details = await fetchCachedEntityDetails(address, network);
        return NextResponse.json(details, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Entity details API error: %s', message);
        return NextResponse.json(null, {
            status: 500,
            headers: { 'Cache-Control': 'no-store' },
        });
    }
}
