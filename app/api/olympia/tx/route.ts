import type { NextRequest } from 'next/server';
import { getTransactionById } from '@/services/olympia';
import { fail, handle, ok, txIdSchema } from '@/services/olympia/http';

/** GET /api/olympia/tx?id=<64 hex> — an Olympia transaction in full. */
export async function GET(request: NextRequest) {
  const parsed = txIdSchema.safeParse(request.nextUrl.searchParams.get('id'));
  if (!parsed.success) return fail(400, 'invalid_id');
  return handle(request, 'tx', async () => {
    const tx = await getTransactionById(parsed.data);
    return tx ? ok(tx) : fail(404, 'not_on_olympia');
  });
}
