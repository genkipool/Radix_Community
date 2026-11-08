import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAccountTxPage } from '@/services/olympia';
import { accountOf, accountParamSchema, fail, handle, ok } from '@/services/olympia/http';

const query = z.object({
  address: accountParamSchema,
  before: z.string().regex(/^\d{1,12}$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});

/**
 * GET /api/olympia/account/transactions?address=…&before=<stateVersion>&limit=15
 *
 * An Olympia account's transactions, newest first, with its actions and
 * balance changes. `nextCursor` is the `before` of the next page.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = query.safeParse({ address: sp.get('address'), before: sp.get('before') ?? undefined, limit: sp.get('limit') ?? undefined });
  if (!parsed.success) return fail(400, 'invalid_query');
  const { address, before, limit } = parsed.data;
  return handle(request, 'account/transactions', async () => {
    const ref = await accountOf(address);
    if (!ref) return fail(404, 'not_on_olympia');
    return ok(await getAccountTxPage(ref, before ? BigInt(before) : null, limit));
  });
}
