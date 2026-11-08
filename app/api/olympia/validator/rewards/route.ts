import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getValidatorRewards } from '@/services/olympia';
import { fail, handle, ok, validatorParamSchema, yearSchema } from '@/services/olympia/http';

const query = z.object({ address: validatorParamSchema, year: yearSchema });

/**
 * GET /api/olympia/validator/rewards?address=rv1…&year=2022
 *
 * A validator's daily rewards in a year: the owner's fee, what its delegators
 * earned and its total stake. Read from Redis like Babylon's, with the dataset
 * as fallback.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = query.safeParse({ address: sp.get('address'), year: sp.get('year') });
  if (!parsed.success) return fail(400, 'invalid_query');
  return handle(request, 'validator/rewards', async () => ok({
    address: parsed.data.address,
    year: parsed.data.year,
    days: await getValidatorRewards(parsed.data.address, parsed.data.year),
  }));
}
