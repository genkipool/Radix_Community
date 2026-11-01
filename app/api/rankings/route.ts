import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { validateNetwork, validateCursor } from '@/utils/apiValidation';
import { GATEWAY_BASES } from '@/services/gateway/bases';
import { getXrdAddress } from '@/features/dashboard/explorador/constants';
import { after } from 'next/server';
import { readTopLsu, advanceTopLsu } from '@/services/gateway/rankings';
import { readAccessControllers, advanceAccessControllers } from '@/services/gateway/accessControllers';
import { readValidatorWatch } from '@/services/gateway/validatorWatch';

/** Accounts per page of the rankings that are stored whole and paged here (LSU positions, Access Controllers). */
const LSU_PAGE = 25;

/**
 * Holders asked for per request. XRD is also held by components and validators'
 * vaults, which are dropped, so a page carries somewhat fewer accounts than this.
 */
const HOLDERS_PAGE = 30;

interface HolderItem {
    holder_address: string;
    amount: string;
}

/**
 * GET /api/rankings?type=top_accounts|top_lsu|access_controllers|owner_unlocks|fee_changes&network=mainnet[&cursor=…]
 *
 * `top_accounts`: the accounts holding the most XRD, one page at a time. The Gateway's
 * resource-holders extension already returns holders ordered by balance and
 * hands back a cursor for the next page, so there is no crawl and no store: the
 * client asks for more only as the list is scrolled.
 *
 * `top_lsu`: the biggest stake positions (see services/gateway/rankings), served
 * from the list Redis holds and paged by offset.
 *
 * `access_controllers`: the accounts shielded by an Access Controller, newest first
 * (see services/gateway/accessControllers), served and paged the same way.
 *
 * `owner_unlocks`: the validators whose owner has LSUs in the unlock period, the
 * one that frees up first at the top. `fee_changes`: the validators with a
 * commission change waiting to take effect, the soonest first. Both are read from
 * the validator list itself (see services/gateway/validatorWatch), so there is
 * no scan to build.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type');
    if (type !== 'top_accounts' && type !== 'top_lsu' && type !== 'access_controllers' && type !== 'owner_unlocks' && type !== 'fee_changes') {
        return NextResponse.json({ error: 'unsupported_ranking' }, { status: 400 });
    }
    const network = validateNetwork(searchParams.get('network'));

    if (type === 'owner_unlocks' || type === 'fee_changes') {
        const rawOffset = searchParams.get('cursor');
        const offset = rawOffset && /^\d{1,5}$/.test(rawOffset) ? Number(rawOffset) : 0;
        try {
            const watch = await readValidatorWatch(network);
            const validators = (type === 'owner_unlocks' ? watch.ownerUnlocks : watch.feeChanges).map(u => u.validator);
            const page = validators.slice(offset, offset + LSU_PAGE);
            return NextResponse.json({
                accounts: page.map(address => ({ address })),
                nextCursor: offset + LSU_PAGE < validators.length ? String(offset + LSU_PAGE) : undefined,
            }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ err: error, network }, 'Validator ranking error: %s', message);
            return NextResponse.json({ error: 'rankings_unavailable' }, {
                status: 503,
                headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' },
            });
        }
    }

    if (type === 'access_controllers') {
        const rawOffset = searchParams.get('cursor');
        const offset = rawOffset && /^\d{1,5}$/.test(rawOffset) ? Number(rawOffset) : 0;
        try {
            const { accounts, partial, wantsStep } = await readAccessControllers(network);
            if (wantsStep) after(() => advanceAccessControllers(network));
            const page = accounts.slice(offset, offset + LSU_PAGE);
            return NextResponse.json({
                accounts: page.map(a => ({ address: a.address, controller: a.controller })),
                nextCursor: offset + LSU_PAGE < accounts.length ? String(offset + LSU_PAGE) : undefined,
                partial,
            }, {
                headers: {
                    'Cache-Control': wantsStep
                        ? 'public, s-maxage=15, stale-while-revalidate=30'
                        : 'public, s-maxage=60, stale-while-revalidate=300',
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ err: error, network }, 'Access Controller ranking error: %s', message);
            return NextResponse.json({ error: 'rankings_unavailable' }, {
                status: 503,
                headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' },
            });
        }
    }

    if (type === 'top_lsu') {
        // Served from what Redis holds — the Gateway is never asked on a visitor's behalf.
        // The cursor is an offset into that list.
        const rawOffset = searchParams.get('cursor');
        const offset = rawOffset && /^\d{1,4}$/.test(rawOffset) ? Number(rawOffset) : 0;
        try {
            const { positions, partial, wantsStep } = await readTopLsu(network);
            // One more scan step after the response, if the ranking needs it. Steps are
            // spaced out by a lock, so a crowd of visitors still makes one.
            if (wantsStep) after(() => advanceTopLsu(network));
            const page = positions.slice(offset, offset + LSU_PAGE);
            return NextResponse.json({
                accounts: page.map(p => ({ address: p.address, amount: String(p.xrd), validator: p.validator })),
                nextCursor: offset + LSU_PAGE < positions.length ? String(offset + LSU_PAGE) : undefined,
                partial,
            }, {
                headers: {
                    // While it is being built it is polled, so a short cache; once done, a longer one.
                    'Cache-Control': wantsStep
                        ? 'public, s-maxage=15, stale-while-revalidate=30'
                        : 'public, s-maxage=60, stale-while-revalidate=300',
                },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ err: error, network }, 'LSU ranking error: %s', message);
            return NextResponse.json({ error: 'rankings_unavailable' }, {
                status: 503,
                headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' },
            });
        }
    }

    const cursor = validateCursor(searchParams.get('cursor'));

    try {
        const res = await fetch(`${GATEWAY_BASES[network]}/extensions/resource-holders/page`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource_address: getXrdAddress(network), limit_per_page: HOLDERS_PAGE, cursor }),
            next: { revalidate: 300 },
        });
        if (!res.ok) throw new Error(`Gateway ${res.status}`);

        const data = (await res.json()) as { items?: HolderItem[]; next_cursor?: string | null };
        const accounts = (data.items ?? [])
            .filter(item => item.holder_address.startsWith('account_'))
            .map(item => ({ address: item.holder_address, amount: item.amount }));

        return NextResponse.json({ accounts, nextCursor: data.next_cursor || undefined }, {
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ err: error, network }, 'Rankings API error: %s', message);
        return NextResponse.json({ error: 'rankings_unavailable' }, {
            status: 503,
            headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' },
        });
    }
}
