import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getTransactionsByDate } from '@/services/olympia/byDate';
import { fail, handle, ok } from '@/services/olympia/http';

const ms = z.coerce.number().int().min(0).max(4_102_444_800_000);
const query = z.object({
  from: ms,
  to: ms,
  before: z.string().regex(/^\d{1,12}$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(15),
}).refine((q) => q.from <= q.to);

/**
 * GET /api/olympia/transactions?from=<ms>&to=<ms>&before=<stateVersion>&limit=15
 *
 * Every Olympia transaction between two instants (milliseconds since 1970,
 * inclusive), newest first, in full. `nextCursor` is the `before` of the next
 * page. What the explorer's calendar shows for days before Babylon.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = query.safeParse({
    from: sp.get('from'),
    to: sp.get('to'),
    before: sp.get('before') ?? undefined,
    limit: sp.get('limit') ?? undefined,
  });
  if (!parsed.success) return fail(400, 'invalid_query');
  const { from, to, before, limit } = parsed.data;
  return handle(request, 'transactions', async () => ok(await getTransactionsByDate(from, to, before ? BigInt(before) : null, limit)));
}
