import { NextResponse } from 'next/server';
import { getValidatorsCached } from '@/services/radixApi';
import logger from '@/lib/logger';
import { validateNetwork } from '@/utils/apiValidation';

/** Never cached, and asks the caller to come back: this is a hiccup, not an answer. */
const unavailable = (message: string) =>
    NextResponse.json(
        { error: message },
        {
            status: 503,
            headers: {
                'Cache-Control': 'no-store',
                'Retry-After': '5',
            },
        },
    );

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));

    try {
        const { validators, networkStats } = await getValidatorsCached(network);

        // An empty set is not a state this network can be in: every Radix
        // network has validators. Answering 200 with an empty list told the
        // browser the read had succeeded, so it cached "nothing" for five
        // minutes and printed "no staking nodes found" over a Gateway hiccup.
        if (validators.length === 0) {
            logger.warn({ network }, '[ValidatorsAPI] Empty validator set — answering 503');
            return unavailable('validators_unavailable');
        }

        logger.info({
            network,
            count: validators.length,
            epoch: networkStats?.epoch
        }, 'Serving validators data');

        return NextResponse.json(
            { validators, networkStats },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
                },
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Validators API error: %s', message);
        return unavailable(message);
    }
}
