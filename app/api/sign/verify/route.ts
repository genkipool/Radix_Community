import { NextResponse, type NextRequest } from 'next/server';
import { MAX_ENVELOPE_BYTES } from '@/features/sign/constants/limits';
import { enforceSignRateLimit } from '@/features/sign/lib/rate-limit.server';
import {
  VerifyCertificateError,
  verifyBodySchema,
  verifyCertificateEnvelope,
} from '@/features/sign/lib/verify.server';

/**
 * POST /api/sign/verify
 *
 * Thin stateless HTTP adapter over `verifyCertificateEnvelope` (shared SSoT
 * with the `verify_document_signature` MCP tool).
 */
export async function POST(req: NextRequest) {
  const limited = await enforceSignRateLimit(req);
  if (limited) return limited;

  const raw = await req.text();
  if (raw.length > MAX_ENVELOPE_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = verifyBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_certificate' }, { status: 400 });
  }

  try {
    const result = await verifyCertificateEnvelope(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof VerifyCertificateError && err.code === 'invalid_network') {
      return NextResponse.json({ error: 'invalid_network' }, { status: 400 });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
