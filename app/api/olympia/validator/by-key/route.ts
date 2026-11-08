import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { findValidatorByPublicKey } from '@/services/olympia';
import { fail, handle, ok } from '@/services/olympia/http';

/** A compressed secp256k1 public key, as Babylon and Olympia validators both show it. */
const keySchema = z.string().regex(/^0[23][0-9a-fA-F]{64}$/);

/**
 * GET /api/olympia/validator/by-key?key=<66 hex>
 *
 * The Olympia validator that ran with this node key, so a Babylon validator
 * that kept its Olympia key can point to its Olympia address. Answered from
 * the in-memory validator catalog (254 rows): no per-request read.
 */
export async function GET(request: NextRequest) {
  const parsed = keySchema.safeParse(request.nextUrl.searchParams.get('key'));
  if (!parsed.success) return fail(400, 'invalid_key');
  return handle(request, 'validator/by-key', async () => {
    const v = await findValidatorByPublicKey(parsed.data);
    return v ? ok({ address: v.address, name: v.name }) : fail(404, 'not_on_olympia');
  });
}
