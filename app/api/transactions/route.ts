import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { validateAddress, validateNetwork, validateCursor, validateLimit } from '@/utils/apiValidation';
import {
    fetchRecentTransactions,
    searchTransactionsByAddress,
    fetchFilteredTransactions,
} from '@/services/radixApi';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const cursor           = validateCursor(searchParams.get('cursor'));
    const limit            = validateLimit(searchParams.get('limit'));
    const rawAddress       = searchParams.get('address') || '';
    const address          = rawAddress ? (validateAddress(rawAddress) ?? '') : '';
    const network          = validateNetwork(searchParams.get('network'));
    const tag              = searchParams.get('tag')   || 'All';
    const start            = searchParams.get('start') || undefined;
    const end              = searchParams.get('end')   || undefined;
    const tzOffsetMinutes  = parseInt(searchParams.get('tz') || '0', 10);

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
                tzOffsetMinutes,
            });
        } else if (address) {
            result = await searchTransactionsByAddress(address, cursor, limit, network);
        } else {
            result = await fetchRecentTransactions(cursor, limit, network);
        }

        logger.info({ 
            network, 
            count: result.transactions.length,
            hasMore: !!result.nextCursor 
        }, 'Serving transaction data');

        return NextResponse.json(result, {
            headers: {
                // Short CDN cache — transactions change frequently.
                'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error }, 'Transaction API error: %s', message);
        return NextResponse.json(
            { transactions: [], nextCursor: undefined, error: message },
            { status: 500 },
        );
    }
}
