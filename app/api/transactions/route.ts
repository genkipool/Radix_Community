import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { validateAddress, validateNetwork, validateCursor, validateLimit } from '@/utils/apiValidation';
import {
    getRecentTransactionsCached,
    searchTransactionsByAddress,
    fetchFilteredTransactions,
} from '@/services/radixApi';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const cursor = validateCursor(searchParams.get('cursor'));
    const limit = validateLimit(searchParams.get('limit'));
    const rawAddress = searchParams.get('address') || '';
    const address = rawAddress ? (validateAddress(rawAddress) ?? '') : '';
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

        if (result.transactions.length === 0) {
            logger.warn({ network, tag, address, cursor: !!cursor }, 'SERVED EMPTY TRANSACTIONS');
            return NextResponse.json(result, {
                headers: { 'Cache-Control': 'no-store, max-age=0' },
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
                    ? 'no-store, max-age=0'
                    : 'public, s-maxage=10, stale-while-revalidate=30',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Transaction API error: %s', message);
        return NextResponse.json(
            { error: message },
            {
                status: 500,
                headers: { 'Cache-Control': 'no-store, max-age=0' }
            },
        );
    }
}
