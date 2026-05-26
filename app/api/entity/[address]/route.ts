import { NextRequest, NextResponse } from 'next/server';
import { fetchEntityDetails } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateAddress, validateNetwork } from '@/utils/apiValidation';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    const { address: rawAddress } = await params;
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));
    const isRefresh = searchParams.get('refresh') === 'true';
    const address = validateAddress(rawAddress);
    
    if (!address) return NextResponse.json(null, { status: 400 });

    if (isRefresh) {
        const { revalidateTag } = await import('next/cache');
        // @ts-expect-error Next.js 16 type mismatch for revalidateTag
        revalidateTag(`entity-${address}`);
    }

    try {
        const details = await fetchEntityDetails(address, network);
        
        return NextResponse.json(details, {
            headers: {
                'Cache-Control': isRefresh 
                    ? 'no-cache, no-store, must-revalidate'
                    : 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Entity details API error: %s', message);
        return NextResponse.json(null, {
            status: 500,
            headers: { 'Cache-Control': 'no-cache, private, max-age=0, must-revalidate' },
        });
    }
}
