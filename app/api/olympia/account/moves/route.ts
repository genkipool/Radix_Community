import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAccountMovesInYear } from '@/services/olympia';
import { accountOf, accountParamSchema, fail, handle, ok, yearSchema } from '@/services/olympia/http';

const query = z.object({ address: accountParamSchema, year: yearSchema });

/**
 * GET /api/olympia/account/moves?address=…&year=2022
 *
 * Every change of an Olympia account's liquid balance in a year, oldest
 * first: its transactions (fee, stakes, unstake requests, net change per
 * token) and the ledger changes with no transaction of their own (stake
 * returned after an unstake, the genesis balance). What the "All" rewards
 * CSV lists besides the rewards. `tooMany` past 10,000 changes in the year.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = query.safeParse({ address: sp.get('address'), year: sp.get('year') });
  if (!parsed.success) return fail(400, 'invalid_query');
  return handle(request, 'account/moves', async () => {
    const ref = await accountOf(parsed.data.address);
    if (!ref) return fail(404, 'not_on_olympia');
    return ok({ olympiaAddress: ref.address, year: parsed.data.year, ...(await getAccountMovesInYear(ref, parsed.data.year)) });
  });
}
