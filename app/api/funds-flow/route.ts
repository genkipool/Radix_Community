import { NextRequest, NextResponse } from 'next/server';
import { validateAddress, validateNetwork } from '@/utils/apiValidation';
import { readFundsFlow, readDestinationHints, shared } from '@/services/gateway/fundsFlow';

/**
 * GET /api/funds-flow?address=account_…&network=mainnet[&hints=1]
 *
 * Where an account's XRD comes from and where it goes, over its latest 300
 * transactions. With `hints=1`, instead, what its biggest destinations do with
 * the XRD they are given — a few more Gateway reads, asked for separately so the
 * flow itself is not kept waiting.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const network = validateNetwork(searchParams.get('network'));
    const address = validateAddress(searchParams.get('address'));
    if (!address || !address.startsWith('account_')) {
        return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    }
    const hints = searchParams.get('hints') === '1';

    try {
        const body = hints
            ? { hints: await shared(`hints:${network}:${address}`, () => readDestinationHints(address, network)) }
            : await shared(`flow:${network}:${address}`, () => readFundsFlow(address, network));
        return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
    } catch {
        return NextResponse.json({ error: 'flow_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } });
    }
}
