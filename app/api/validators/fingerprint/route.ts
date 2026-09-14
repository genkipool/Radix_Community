import { NextResponse } from 'next/server';
import { fetchLiveValidatorSetFingerprint } from '@/services/gateway/validatorSetFingerprint';
import { validateNetwork } from '@/utils/apiValidation';

/**
 * The live validator set fingerprint, for clients to notice a change in the
 * list (a new validator, a registration, a fee or profile change) long before
 * their cached copy expires. Cheap by design: polled every half minute.
 */
export async function GET(request: Request) {
    const network = validateNetwork(new URL(request.url).searchParams.get('network'));
    const fingerprint = await fetchLiveValidatorSetFingerprint(network);

    if (!fingerprint) {
        return NextResponse.json(
            { error: 'fingerprint_unavailable' },
            { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '15' } },
        );
    }

    return NextResponse.json(
        { fingerprint },
        { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=15' } },
    );
}
