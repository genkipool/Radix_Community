import { NextResponse, type NextRequest } from 'next/server';
import { Rola } from '@radixdlt/rola';
import { z } from 'zod';
import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';

const bodySchema = z.object({
  networkId: z.union([z.literal(1), z.literal(2)]),
  challenge: z.string().min(32).max(128),
  items: z.array(
    z.object({
      type: z.enum(['account', 'persona']),
      address: z.string().min(10).max(120),
      proof: z.object({
        publicKey: z.string(),
        signature: z.string(),
        curve: z.enum(['curve25519', 'secp256k1']),
      }),
    }),
  ).min(1).max(10),
});

/**
 * Stateless ROLA verification for the wallet playground: checks ownership
 * proofs without creating any session or cookie.
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { networkId, challenge, items } = parsed.data;

  const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!expectedOrigin) {
    return NextResponse.json({ error: 'Server origin not configured' }, { status: 500 });
  }

  const config = NETWORKS[networkId as RadixNetworkId];
  const { verifySignedChallenge } = Rola({
    networkId: config.networkId,
    applicationName: 'Radix Community',
    dAppDefinitionAddress: config.dAppDefinitionAddress,
    expectedOrigin,
  });

  const results = await Promise.all(
    items.map(async (item) => {
      const result = await verifySignedChallenge({
        type: item.type,
        challenge,
        proof: item.proof,
        address: item.address,
      });
      return { address: item.address, verified: result.isOk() };
    }),
  );

  return NextResponse.json({ results });
}
