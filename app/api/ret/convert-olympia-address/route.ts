import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { convertOlympiaAddress } from '@/services/ret';
import { retRequestSchema } from '../validation';

const bodySchema = retRequestSchema.extend({
  olympiaAddress: z.string().min(10).max(120),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const babylonAddress = await convertOlympiaAddress(
      parsed.data.olympiaAddress,
      parsed.data.network,
    );
    return NextResponse.json({ babylonAddress });
  } catch {
    return NextResponse.json({ error: 'Invalid Olympia address' }, { status: 400 });
  }
}
