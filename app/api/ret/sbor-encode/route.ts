import { NextRequest, NextResponse } from 'next/server';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import { z } from 'zod';

const bodySchema = z.object({
  payload: z.string().min(1).max(4_000_000),
  network: z.string(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { payload } = parsed.data;

  try {
    // 1. Try to parse the payload as JSON (Scrypto Programmatic JSON)
    let jsonObj;
    try {
      jsonObj = JSON.parse(payload);
    } catch {
      // Not JSON. Currently we only support Scrypto JSON encoding via UI
      return NextResponse.json({ error: 'Manifest encoding not yet supported, please provide Scrypto JSON' }, { status: 501 });
    }

    // 2. Encode using the RadixEngineToolkit
    const bytes = await RadixEngineToolkit.ScryptoSbor.encodeProgrammaticJson(jsonObj);
    const hex = Buffer.from(bytes).toString('hex');
    
    return NextResponse.json({ kind: 'hex', decoded: hex });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to encode payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
