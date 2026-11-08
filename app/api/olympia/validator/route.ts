import type { NextRequest } from 'next/server';
import { getValidator } from '@/services/olympia';
import { fail, handle, ok, validatorParamSchema } from '@/services/olympia/http';

/** GET /api/olympia/validator?address=rv1… — an Olympia validator, its stake, delegators and rewards. */
export async function GET(request: NextRequest) {
  const parsed = validatorParamSchema.safeParse(request.nextUrl.searchParams.get('address'));
  if (!parsed.success) return fail(400, 'invalid_address');
  return handle(request, 'validator', async () => {
    const v = await getValidator(parsed.data);
    return v ? ok(v) : fail(404, 'not_on_olympia');
  });
}
