import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, clientIp } from '@/services/mcp/rate-limit';
import { fetchTimeStampToken } from '@/features/sign/lib/tsa';
import { verifyTimeStampToken } from '@/features/sign/lib/tsa-verify';

/**
 * POST /api/sign/timestamp
 *
 * Obtains an RFC 3161 timestamp token for one off-ledger signature.
 *
 * The browser cannot talk to a Time Stamping Authority itself (none of them
 * serve CORS), so the app relays the round trip. What is relayed is the imprint
 * only — a SHA-256 over the signer's account, the document challenge and the
 * signature bytes — so neither this server nor the authority sees the document,
 * its hash, or who signed it.
 *
 * The token is verified here before it is handed back, so a certificate never
 * ends up carrying something that will fail at verification time. `genTime` is
 * returned separately because the client records it as the signature's date:
 * the signer's own clock is exactly what a trusted timestamp exists to replace.
 */

const bodySchema = z
  .object({ imprint: z.string().regex(/^[0-9a-f]{64}$/) })
  .strict();

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req.headers));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const { imprint } = parsed.data;

  let token: Uint8Array;
  try {
    token = await fetchTimeStampToken(imprint);
  } catch {
    // The authority is unreachable or refused. Signing must not depend on it,
    // so this is a plain "no timestamp this time", not a failure to sign.
    return NextResponse.json({ error: 'tsa_unavailable' }, { status: 502 });
  }

  const check = verifyTimeStampToken(token, imprint);
  if (!check.valid || !check.genTime) {
    return NextResponse.json(
      { error: 'tsa_invalid', reason: check.reason },
      { status: 502 },
    );
  }

  return NextResponse.json({
    token: Buffer.from(token).toString('base64'),
    genTime: check.genTime,
    authority: check.authority,
    trusted: check.trusted,
  });
}
