import type { NextRequest } from 'next/server';
import { readOlympiaFunds } from '@/services/olympia';
import { accountOf, accountParamSchema, fail, handle, ok } from '@/services/olympia/http';

/**
 * GET /api/olympia/account/funds?address=…
 *
 * Where an Olympia account's XRD came from and where it went (its latest 5000
 * actions), in the same shape as `/api/funds-flow`.
 */
export async function GET(request: NextRequest) {
  const parsed = accountParamSchema.safeParse(request.nextUrl.searchParams.get('address'));
  if (!parsed.success) return fail(400, 'invalid_address');
  return handle(request, 'account/funds', async () => {
    const ref = await accountOf(parsed.data);
    if (!ref) return fail(404, 'not_on_olympia');
    return ok({ olympiaAddress: ref.address, ...(await readOlympiaFunds(ref)) });
  });
}
