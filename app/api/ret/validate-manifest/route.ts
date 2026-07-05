import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { staticallyValidateManifest } from '@/services/ret';
import { retRequestSchema } from '../validation';

const bodySchema = retRequestSchema.extend({
  manifest: z.string().min(1).max(1_000_000),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = await staticallyValidateManifest(parsed.data.manifest, parsed.data.network);
  return NextResponse.json(result);
}
