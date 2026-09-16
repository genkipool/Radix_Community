import { NextResponse } from 'next/server';
import { fetchProtocolVotes, forgetProtocolVote, advanceVoteTail } from '@/services/gateway/protocolVotes';
import { validateAddress, validateNetwork } from '@/utils/apiValidation';
import logger from '@/lib/logger';

/**
 * The protocol-update signal each of these validators has cast, read from the
 * ledger rather than from the snapshot the validator list carries.
 *
 * Asked only for the validators the connected wallet owns, which is why the
 * set is capped: those are the ones whose badge is a button, and reading them
 * live is what stops a reload from offering a vote that was already signed.
 */

/** Owning more than this many validators from one wallet is not a real case. */
const MAX_ADDRESSES = 20;

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));

    const requested = (searchParams.get('addresses') ?? '')
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

    const addresses = requested.map(validateAddress).filter((a): a is string => a !== null);

    if (addresses.length !== requested.length) {
        return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    }
    if (addresses.length === 0) {
        return NextResponse.json({ votes: {} }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (addresses.length > MAX_ADDRESSES) {
        return NextResponse.json({ error: 'too_many_addresses' }, { status: 400 });
    }

    try {
        const votes = await fetchProtocolVotes(addresses, network);
        return NextResponse.json(
            { votes },
            { headers: { 'Cache-Control': 'private, max-age=30' } },
        );
    } catch (error) {
        logger.error({ err: error, network }, '[VotesAPI] Failed to read protocol votes');
        return NextResponse.json(
            { error: 'votes_unavailable' },
            { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } },
        );
    }
}

/**
 * Forgets the cached answer for one validator, used right after a vote has
 * been signed so the badge settles on the ledger's word within seconds
 * instead of waiting out the cache.
 */
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const network = validateNetwork(searchParams.get('network'));
    const address = validateAddress(searchParams.get('address'));

    if (!address) {
        return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
    }

    await forgetProtocolVote(address, network);
    /*
     * A vote was just signed, so this is the cheapest moment to move the tail:
     * it puts the new signal in the shared store for everyone, not just for
     * the owner whose own badge already reads it live.
     */
    await advanceVoteTail(network);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
