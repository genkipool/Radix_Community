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
    const address = validateAddress(rawAddress);
    if (!address) return NextResponse.json(null, { status: 400 });

    try {
        const details = await fetchEntityDetails(address, network);
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
