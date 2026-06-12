import { NextRequest, NextResponse } from 'next/server';
import {
  ManifestSborStringRepresentation,
  RadixEngineToolkit,
} from '@radixdlt/radix-engine-toolkit';
import { z } from 'zod';
import { networkIdFromName, retRequestSchema } from '../validation';

const bodySchema = retRequestSchema.extend({
  hexEncodedSchema: z.string().regex(/^[0-9a-fA-F]+$/).max(4_000_000),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const decodedString = await RadixEngineToolkit.ManifestSbor.decodeToString(
      Buffer.from(parsed.data.hexEncodedSchema, 'hex'),
      networkIdFromName(parsed.data.network),
      ManifestSborStringRepresentation.ManifestString,
    );
    return NextResponse.json({ decodedString });
  } catch {
    return NextResponse.json({ error: 'Failed to decode schema' }, { status: 400 });
  }
}
