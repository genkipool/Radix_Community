import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getValidatorDelegators } from '@/services/olympia';
import { fail, handle, ok, validatorParamSchema } from '@/services/olympia/http';

const query = z.object({
  address: validatorParamSchema,
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/olympia/validator/delegators?address=rv1…&offset=50&limit=50
 *
 * A page of an Olympia validator's delegators when Olympia ended, biggest
 * stake first, and how many there were in all.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = query.safeParse({ address: sp.get('address'), offset: sp.get('offset') ?? undefined, limit: sp.get('limit') ?? undefined });
  if (!parsed.success) return fail(400, 'invalid_query');
  const { address, offset, limit } = parsed.data;
  return handle(request, 'validator/delegators', async () => ok(await getValidatorDelegators(address, offset, limit)));
}
