import { NextRequest, NextResponse } from 'next/server';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import { z } from 'zod';
import { networkIdFromName, retRequestSchema } from '../validation';

const bodySchema = retRequestSchema.extend({
  olympiaAddress: z.string().min(10).max(120),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { olympiaAddress, network } = parsed.data;
  const networkId = networkIdFromName(network);

  try {
    const babylonAddress = olympiaAddress.toLowerCase().includes('_rr1')
      ? await RadixEngineToolkit.Derive.resourceAddressFromOlympiaResourceAddress(
          olympiaAddress,
          networkId,
        )
      : await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(
          olympiaAddress,
          networkId,
        );

    return NextResponse.json({ babylonAddress });
  } catch {
    return NextResponse.json({ error: 'Invalid Olympia address' }, { status: 400 });
  }
}
