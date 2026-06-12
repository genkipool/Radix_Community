import { NextRequest, NextResponse } from 'next/server';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import { z } from 'zod';
import { networkIdFromName, retRequestSchema } from '../validation';

const bodySchema = retRequestSchema.extend({
  manifest: z.string().min(1).max(1_000_000),
});

/** Extracts the human-relevant reason from a RET invocation error message. */
function extractError(message: string): string {
  const match = message.match(/"error":\s*"((?:[^"\\]|\\.)*)"/);
  return match ? match[1].replace(/\\"/g, '"') : message.slice(0, 300);
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const result = await RadixEngineToolkit.Instructions.staticallyValidate(
      { kind: 'String', value: parsed.data.manifest },
      networkIdFromName(parsed.data.network),
    );
    if (result.kind === 'Valid') {
      return NextResponse.json({ valid: true });
    }
    return NextResponse.json({
      valid: false,
      error: (result as { error?: string }).error ?? 'Invalid manifest',
    });
  } catch (err) {
    // Parse errors are thrown by RET — surface the reason as a validation failure
    return NextResponse.json({
      valid: false,
      error: extractError(err instanceof Error ? err.message : String(err)),
    });
  }
}
