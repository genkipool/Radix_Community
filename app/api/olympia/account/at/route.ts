import type { NextRequest } from 'next/server';
import { getAccountStateAt } from '@/services/olympia';
import { accountOf, accountParamSchema, fail, handle, ok, olympiaAtSchema } from '@/services/olympia/http';

/**
 * GET /api/olympia/account/at?address=rdx1…|account_rdx1…&at=<state version|YYYY-MM-DD>
 *
 * What an Olympia account held at one point of Olympia: liquid balances and
 * stakes, as the official Olympia Gateway answers with `at_state_identifier`.
 * A day (UTC) is read at its last state version.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const address = accountParamSchema.safeParse(params.get('address'));
  if (!address.success) return fail(400, 'invalid_address');
  const at = olympiaAtSchema.safeParse(params.get('at'));
  if (!at.success) return fail(400, 'invalid_at');
  return handle(request, 'account-at', async () => {
    const ref = await accountOf(address.data);
    if (!ref) return fail(404, 'not_on_olympia');
    return ok(await getAccountStateAt(ref, at.data.stateVersion, at.data.day));
  });
}
