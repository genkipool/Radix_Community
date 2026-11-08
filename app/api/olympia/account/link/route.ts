import type { NextRequest } from 'next/server';
import { findLinkByBabylon } from '@/services/olympia';
import { babylonAccountSchema, fail, handle, ok } from '@/services/olympia/http';

/**
 * GET /api/olympia/account/link?address=account_rdx1…
 *
 * The Olympia address a Babylon account was migrated from. Cheap (one small
 * read), so cards can ask it to decide whether to show their Olympia parts.
 */
export async function GET(request: NextRequest) {
  const parsed = babylonAccountSchema.safeParse(request.nextUrl.searchParams.get('address'));
  if (!parsed.success) return fail(400, 'invalid_address');
  return handle(request, 'account/link', async () => {
    const link = await findLinkByBabylon(parsed.data);
    return link ? ok(link) : fail(404, 'not_on_olympia');
  });
}
