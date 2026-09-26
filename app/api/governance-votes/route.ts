import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { validateAddress } from '@/utils/apiValidation';
import { collectorFor, fetchVoteTally, type CollectorItemType } from '@/services/governance/voteCollector';

const TYPES: readonly CollectorItemType[] = ['proposal', 'temperature_check'];
const NO_STORE = { 'Cache-Control': 'no-cache, private, max-age=0, must-revalidate' };

/**
 * GET /api/governance-votes?component=…&type=proposal|temperature_check&id=…&account=…
 * Weighted tally of a governance vote, taken from that dApp's vote collector.
 */
export async function GET(request: NextRequest) {
    const params = new URL(request.url).searchParams;
    const component = validateAddress(params.get('component'));
    const type = params.get('type') as CollectorItemType | null;
    const id = params.get('id') ?? '';
    const account = params.get('account') ? validateAddress(params.get('account')) : null;

    if (!component || !type || !TYPES.includes(type) || !/^\d{1,19}$/.test(id)) {
        return NextResponse.json(null, { status: 400, headers: NO_STORE });
    }
    // A governance dApp without a known collector is not an error: there is just no tally.
    if (!collectorFor(component)) return NextResponse.json(null, { headers: NO_STORE });

    try {
        const tally = await fetchVoteTally(component, type, id, account);
        return NextResponse.json(tally, {
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
        });
    } catch (error) {
        logger.warn({ err: error }, 'Governance vote tally unavailable for %s %s #%s', component, type, id);
        return NextResponse.json(null, { status: 502, headers: NO_STORE });
    }
}
