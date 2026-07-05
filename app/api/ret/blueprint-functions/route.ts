import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchBlueprintInterface } from '@/services/gateway/blueprints';
import { retRequestSchema } from '../validation';

const bodySchema = retRequestSchema.extend({
  packageAddress: z.string().startsWith('package_').max(120),
  blueprintName: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { packageAddress, blueprintName, network } = parsed.data;

  try {
    const blueprint = await fetchBlueprintInterface(packageAddress, blueprintName, network);
    if (!blueprint) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 });
    }
    return NextResponse.json({
      blueprintName: blueprint.blueprintName,
      version: blueprint.version,
      functions: blueprint.functions,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load blueprint' }, { status: 502 });
  }
}
