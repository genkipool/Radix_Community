import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { convertOlympiaAddressDetailed } from '@/services/ret';
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
    const conversion = await convertOlympiaAddressDetailed(
      parsed.data.olympiaAddress,
      parsed.data.network,
    );
    return NextResponse.json(conversion);
  } catch {
    return NextResponse.json({ error: 'Invalid Olympia address' }, { status: 400 });
  }
}
