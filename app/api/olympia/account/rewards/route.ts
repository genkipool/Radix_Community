import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAccountRewards } from '@/services/olympia';
import { accountOf, accountParamSchema, fail, handle, ok, yearSchema } from '@/services/olympia/http';

const query = z.object({ address: accountParamSchema, year: yearSchema });

/**
 * GET /api/olympia/account/rewards?address=…&year=2022
 *
 * Staking rewards an Olympia account earned in a year, per day and validator:
 * as a delegator and, if it owned a validator, its fee.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = query.safeParse({ address: sp.get('address'), year: sp.get('year') });
  if (!parsed.success) return fail(400, 'invalid_query');
  return handle(request, 'account/rewards', async () => {
    const ref = await accountOf(parsed.data.address);
    if (!ref) return fail(404, 'not_on_olympia');
    return ok({ olympiaAddress: ref.address, year: parsed.data.year, days: await getAccountRewards(ref.id, parsed.data.year) });
  });
}
