import type { NextRequest } from 'next/server';
import { getAccountSummary } from '@/services/olympia';
import { accountOf, accountParamSchema, fail, handle, ok } from '@/services/olympia/http';

/**
 * GET /api/olympia/account?address=rdx1…|account_rdx1…
 *
 * What an Olympia account held at the end of Olympia (tokens, stakes), what it
 * did (transactions, fees) and the staking rewards it earned. A Babylon address
 * is answered for the Olympia account it was migrated from.
 */
export async function GET(request: NextRequest) {
  const parsed = accountParamSchema.safeParse(request.nextUrl.searchParams.get('address'));
  if (!parsed.success) return fail(400, 'invalid_address');
  return handle(request, 'account', async () => {
    const ref = await accountOf(parsed.data);
    if (!ref) return fail(404, 'not_on_olympia');
    return ok(await getAccountSummary(ref));
  });
}
