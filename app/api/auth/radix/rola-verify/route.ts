import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';
import { verifyRolaProofs } from '@/services/rola/verify';
import { gatewayOwnerKeys } from '@/services/rola/gateway';

const bodySchema = z.object({
  networkId: z.union([z.literal(1), z.literal(2)]),
  challenge: z.string().min(32).max(128),
  items: z.array(
    z.object({
      type: z.enum(['account', 'persona']),
      address: z.string().min(10).max(120),
      proof: z.object({
        publicKey: z.string().max(200),
        signature: z.string().max(300),
        curve: z.enum(['curve25519', 'secp256k1']),
      }),
    }),
  ).min(1).max(10),
});

/**
 * Stateless ROLA verification for the wallet playground: checks ownership
 * proofs (accounts and personas) without creating any session or cookie, and
 * explains every failure.
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
  const results = await verifyRolaProofs({
    networkId: config.networkId,
    dAppDefinitionAddress: config.dAppDefinitionAddress,
    origin: expectedOrigin,
    challenge,
    proofs: items,
    ownerKeys: gatewayOwnerKeys(networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet'),
  });

  return NextResponse.json({ results });
}
