import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  findOlympiaAddressForBabylonAccount,
  OlympiaReverseError,
} from '@/services/ret/olympia-reverse';
import { retRequestSchema } from '../validation';

const bodySchema = retRequestSchema.extend({
  babylonAddress: z.string().regex(/^account_[a-z0-9_]{10,80}$/),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const result = await findOlympiaAddressForBabylonAccount(
      parsed.data.babylonAddress,
      parsed.data.network,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OlympiaReverseError) {
      return NextResponse.json(
        { error: 'Not resolvable', reason: err.reason },
        { status: err.reason === 'invalid-address' ? 400 : 404 },
      );
    }
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
