import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import { z } from 'zod';
import { networkIdFromName, retRequestSchema } from '../validation';
import { RATE_LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rateLimit';

const bodySchema = retRequestSchema.extend({
  publicKeyHex: z.string().regex(/^[0-9a-fA-F]+$/).min(64).max(132),
  curve: z.enum(['ed25519', 'secp256k1']),
});

export async function POST(request: NextRequest) {
  const rate = await rateLimit(RATE_LIMITS.engine, clientIp(request.headers));
  if (!rate.allowed) return tooManyRequests(rate);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { publicKeyHex, curve, network } = parsed.data;

  try {
    const publicKey =
      curve === 'ed25519' ? new PublicKey.Ed25519(publicKeyHex) : new PublicKey.Secp256k1(publicKeyHex);
    const accountAddress = await RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(
      publicKey,
      networkIdFromName(network),
    );
    const identityAddress = await RadixEngineToolkit.Derive.virtualIdentityAddressFromPublicKey(
      publicKey,
      networkIdFromName(network),
    );
    return NextResponse.json({ accountAddress, identityAddress });
  } catch {
    return NextResponse.json({ error: 'Invalid public key' }, { status: 400 });
  }
}
