import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAccountTxPage } from '@/services/olympia';
import { accountOf, accountParamSchema, fail, handle, ok } from '@/services/olympia/http';

const ms = z.coerce.number().int().min(0).max(4_102_444_800_000);
const query = z.object({
  address: accountParamSchema,
  before: z.string().regex(/^\d{1,12}$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  from: ms.optional(),
  to: ms.optional(),
}).refine((q) => (q.from === undefined && q.to === undefined) || (q.from !== undefined && q.to !== undefined && q.from <= q.to));

/**
 * GET /api/olympia/account/transactions?address=…&before=<stateVersion>&limit=15[&from=<ms>&to=<ms>]
 *
 * An Olympia account's transactions, newest first, with its actions and
 * balance changes. `nextCursor` is the `before` of the next page. When `from`
 * and `to` (epoch ms, inclusive) are given, only transactions in that time
 * window are returned.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = query.safeParse({
    address: sp.get('address'),
    before: sp.get('before') ?? undefined,
    limit: sp.get('limit') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
  });
  if (!parsed.success) return fail(400, 'invalid_query');
  const { address, before, limit, from, to } = parsed.data;
  const timeRange = from !== undefined && to !== undefined ? { fromMs: from, toMs: to } : undefined;
  return handle(request, 'account/transactions', async () => {
    const ref = await accountOf(address);
    if (!ref) return fail(404, 'not_on_olympia');
    return ok(await getAccountTxPage(ref, before ? BigInt(before) : null, limit, timeRange));
  });
}
