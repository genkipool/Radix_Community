import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { validateAddress, validateNetwork, validateCursor, validateLimit } from '@/utils/apiValidation';
import {
    getRecentTransactionsCached,
    searchTransactionsByAddress,
    fetchFilteredTransactions,
} from '@/services/radixApi';

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

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const cursor = validateCursor(searchParams.get('cursor'));
    const limit = validateLimit(searchParams.get('limit'));
    const addressParam = searchParams.get('address');
    let address: string | string[] | undefined = undefined;
    if (addressParam) {
        if (addressParam.includes(',')) {
            address = addressParam.split(',').map(a => validateAddress(a)).filter((a): a is string => Boolean(a));
        } else {
            const validated = validateAddress(addressParam);
            if (validated) address = validated;
        }
    }
    const network = validateNetwork(searchParams.get('network'));
    const tag = searchParams.get('tag') || 'All';
    const start = searchParams.get('start') || undefined;
    const end = searchParams.get('end') || undefined;
    const timezone = searchParams.get('tz') || 'UTC';

    logger.info({
        network, tag, address: address || 'All', cursor: !!cursor
    }, 'Incoming transaction request');

    try {
        let result;

        if (tag !== 'All' || start || end) {
            // Delegate to the specialised filtered fetcher which uses native
            // Gateway date params (`from_ledger_state` / `at_ledger_state`).
            result = await fetchFilteredTransactions({
                tag,
                start,
                end,
                cursor,
                limit,
                address: address || undefined,
                network,
                timezone,
            });
        } else if (address) {
            result = await searchTransactionsByAddress(address, cursor, limit, network);
        } else {
            // Use centralized Data Cache for the transaction tip (limit 15/30)
            result = await getRecentTransactionsCached(cursor, limit, network);
        }

        // An empty page is a real answer for a filter, an address or a page
        // past the end: those can legitimately have nothing. The unfiltered tip
        // of mainnet cannot — there is always a last transaction — so an empty
        // one means the read failed, and saying so lets the browser retry
        // instead of printing "no transactions found" over a Gateway hiccup.
        if (result.transactions.length === 0) {
            const isUnfilteredTip = !cursor && !address && tag === 'All' && !start && !end;
            if (isUnfilteredTip) {
                logger.warn({ network }, '[TransactionsAPI] Empty tip — answering 503');
                return unavailable('transactions_unavailable');
            }
            logger.info({ network, tag, address, cursor: !!cursor }, 'No transactions for this query');
            return NextResponse.json(result, {
                headers: { 'Cache-Control': 'no-cache, private, max-age=0, must-revalidate' },
            });
        }

        logger.info({
            network,
            count: result.transactions.length,
            hasMore: !!result.nextCursor
        }, 'Serving transaction data');

        const isFiltered = tag !== 'All' || start || end || address;

        return NextResponse.json(result, {
            headers: {
                'Cache-Control': isFiltered
                    ? 'no-cache, private, max-age=0, must-revalidate'
                    : 'public, s-maxage=10, stale-while-revalidate=30',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Transaction API error: %s', message);
        return unavailable(message);
    }
}
