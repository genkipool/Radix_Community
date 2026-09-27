import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { isValidAddressForNetwork, validateAddress, validateNetwork } from '@/utils/apiValidation';
import { fetchAgeYears } from '@/features/governance/services/accountAge.server';
import { AGE_BATCH } from '@/features/governance/services/governanceApi';

const NO_STORE = { 'Cache-Control': 'no-cache, private, max-age=0, must-revalidate' };

/**
 * GET /api/governance-votes/account-ages?network=mainnet&at=<unix seconds>&accounts=a,b,c
 *
 * Full years each account had been on the ledger at `at` (when a vote
 * opened), used to weigh votes by account age. Only account addresses are
 * accepted.
 */
export async function GET(request: NextRequest) {
    const params = new URL(request.url).searchParams;
    const network = validateNetwork(params.get('network'));
    const at = Number(params.get('at'));
    const accounts = [...new Set((params.get('accounts') ?? '').split(',').filter(Boolean))];
    const valid = accounts.every(a => validateAddress(a) && a.startsWith('account_') && isValidAddressForNetwork(a, network));
    if (!Number.isInteger(at) || at <= 0 || at > Date.now() / 1000 + 86_400 || accounts.length === 0 || accounts.length > AGE_BATCH || !valid) {
        return NextResponse.json(null, { status: 400, headers: NO_STORE });
    }
    try {
        const years = await fetchAgeYears(network, at, accounts);
        return NextResponse.json({ years }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
    } catch (error) {
        logger.warn({ err: error }, 'Account age lookup failed');
        return NextResponse.json(null, { status: 502, headers: NO_STORE });
    }
}
