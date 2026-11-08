import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { olympiaKindOf } from '@/features/dashboard/lib/olympia';
import { findRriByBabylon, getResource } from '@/services/olympia';
import { fail, handle, ok } from '@/services/olympia/http';

const param = z.union([
  z.string().refine((v) => olympiaKindOf(v) === 'resource'),
  z.string().regex(/^resource_rdx1[02-9ac-hj-np-z]{40,80}$/),
]);

/**
 * GET /api/olympia/resource?rri=<symbol>_rr1…|resource_rdx1…
 *
 * An Olympia token: metadata, final supply and top holders. A Babylon resource
 * address is answered for the Olympia token it was migrated from.
 */
export async function GET(request: NextRequest) {
  const parsed = param.safeParse(request.nextUrl.searchParams.get('rri'));
  if (!parsed.success) return fail(400, 'invalid_rri');
  return handle(request, 'resource', async () => {
    const rri = parsed.data.startsWith('resource_') ? await findRriByBabylon(parsed.data) : parsed.data;
    const res = rri ? await getResource(rri) : null;
    return res ? ok(res) : fail(404, 'not_on_olympia');
  });
}
