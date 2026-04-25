import { NextRequest, NextResponse } from 'next/server';
import { fetchNonFungibleDataCached } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateAddress } from '@/utils/apiValidation';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { resourceAddress: rawResource, localIds } = body;
        const resourceAddress = validateAddress(rawResource);
        if (!resourceAddress || !Array.isArray(localIds)) {
            return NextResponse.json([], { status: 400 });
        }
        const safeIds = (localIds as unknown[]).slice(0, 10).filter(id => typeof id === 'string') as string[];
        const data = await fetchNonFungibleDataCached(resourceAddress, safeIds, 'mainnet');
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
