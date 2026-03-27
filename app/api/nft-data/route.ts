import { NextRequest, NextResponse } from 'next/server';
import { fetchNonFungibleData } from '@/services/radixApi';
import { unstable_cache } from 'next/cache';
import logger from '@/lib/logger';
import { validateAddress } from '@/utils/apiValidation';

/**
 * Cache NFT metadata for 10 minutes.
 *
 * NFT names, images, and descriptions rarely change after minting.
 * A short cache is a good balance: stale metadata is not a big deal,
 * but hammering the Gateway for the same popular NFT collection on
 * every modal open is wasteful and slow.
 *
 * unstable_cache key includes resourceAddress + localIds for deduplication.
 */
const fetchCachedNftData = (resourceAddress: string, localIds: string[]) =>
    unstable_cache(
        async () => fetchNonFungibleData(resourceAddress, localIds),
        [`nft-${resourceAddress}-${localIds.join(',')}`],
        { revalidate: 600, tags: ['nft'] },
    )();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { resourceAddress: rawResource, localIds } = body;
        const resourceAddress = validateAddress(rawResource);
        if (!resourceAddress || !Array.isArray(localIds)) {
            return NextResponse.json([], { status: 400 });
        }
        const safeIds = (localIds as unknown[]).slice(0, 10).filter(id => typeof id === 'string') as string[];
        const data = await fetchCachedNftData(resourceAddress, safeIds);
        return NextResponse.json(data, {
            headers: {
                // NFT metadata is mostly immutable — 10 min CDN cache
                'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'NFT data API error: %s', message);
        return NextResponse.json([], { status: 500 });
    }
}
