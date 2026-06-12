import { NextRequest, NextResponse } from 'next/server';
import { RadixEngineToolkit, SerializationMode } from '@radixdlt/radix-engine-toolkit';
import { z } from 'zod';
import {
  parseSchema,
  resolveBlueprintFunctions,
  type ParsedSchema,
  type SborNode,
} from '@/features/console/lib/blueprint-schema';
import { networkIdFromName, retRequestSchema } from '../validation';

const bodySchema = retRequestSchema.extend({
  packageAddress: z.string().startsWith('package_').max(120),
  blueprintName: z.string().min(1).max(100),
});

const GATEWAY_BASES = {
  mainnet: 'https://mainnet.radixdlt.com',
  stokenet: 'https://gateway-stokenet.radix.community',
} as const;

async function gatewayPost<T>(base: string, path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}`);
  return res.json() as Promise<T>;
}

interface BlueprintsPage {
  items?: Array<{
    name?: string;
    version?: string;
    definition?: { interface?: { functions?: Record<string, never> } };
  }>;
}

interface SchemasPage {
  items?: Array<{ schema_hash_hex?: string; schema_hex?: string }>;
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { packageAddress, blueprintName, network } = parsed.data;
  const base = GATEWAY_BASES[network];
  const networkId = networkIdFromName(network);

  try {
    const [blueprints, schemas] = await Promise.all([
      gatewayPost<BlueprintsPage>(base, '/state/package/page/blueprints', {
        package_address: packageAddress,
      }),
      gatewayPost<SchemasPage>(base, '/state/entity/page/schemas', { address: packageAddress }),
    ]);

    const blueprint =
      blueprints.items?.find((item) => item.name === blueprintName) ?? blueprints.items?.[0];
    const functions = blueprint?.definition?.interface?.functions;
    if (!blueprint || !functions) {
      return NextResponse.json({ error: 'Blueprint not found' }, { status: 404 });
    }

    // Decode every package schema once; functions reference them by hash
    const schemasByHash: Record<string, ParsedSchema> = {};
    for (const item of schemas.items ?? []) {
      if (!item.schema_hash_hex || !item.schema_hex) continue;
      try {
        const decoded = await RadixEngineToolkit.ScryptoSbor.decodeToString(
          Buffer.from(item.schema_hex, 'hex'),
          networkId,
          SerializationMode.Programmatic,
        );
        schemasByHash[item.schema_hash_hex] = parseSchema(JSON.parse(decoded) as SborNode);
      } catch {
        // Skip undecodable schemas — affected functions fall back to raw args
      }
    }

    return NextResponse.json({
      blueprintName: blueprint.name,
      version: blueprint.version ?? null,
      functions: resolveBlueprintFunctions(functions, schemasByHash),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load blueprint' }, { status: 502 });
  }
}
