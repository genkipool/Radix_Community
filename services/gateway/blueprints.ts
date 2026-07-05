/**
 * services/gateway/blueprints.ts
 *
 * Blueprint interface resolution: package blueprints + SBOR schema decoding
 * into callable function signatures.
 * Used by: app/api/ret/blueprint-functions and the MCP ledger tools.
 */

import { RadixEngineToolkit, SerializationMode } from '@radixdlt/radix-engine-toolkit';
import {
  parseSchema,
  resolveBlueprintFunctions,
  type ParsedSchema,
  type SborNode,
} from '@/features/console/lib/blueprint-schema';
import { networkIdFromName } from '@/services/ret';
import { withRetry, type Network } from './client';
import { gatewayPost } from './bases';

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

export interface BlueprintInterface {
  blueprintName: string;
  version: string | null;
  functions: ReturnType<typeof resolveBlueprintFunctions>;
  /** All blueprint names published in the package */
  availableBlueprints: string[];
}

/**
 * Resolves the callable interface of a package blueprint. When
 * `blueprintName` is omitted the first blueprint of the package is used.
 * Returns null when the blueprint does not exist.
 */
export async function fetchBlueprintInterface(
  packageAddress: string,
  blueprintName: string | undefined,
  network: Network,
): Promise<BlueprintInterface | null> {
  const networkId = networkIdFromName(network);

  const [blueprints, schemas] = await Promise.all([
    withRetry(() =>
      gatewayPost<BlueprintsPage>(network, '/state/package/page/blueprints', {
        package_address: packageAddress,
      }),
    ),
    withRetry(() =>
      gatewayPost<SchemasPage>(network, '/state/entity/page/schemas', { address: packageAddress }),
    ),
  ]);

  const availableBlueprints = (blueprints.items ?? []).flatMap((item) => item.name ?? []);
  const blueprint =
    (blueprintName ? blueprints.items?.find((item) => item.name === blueprintName) : undefined) ??
    blueprints.items?.[0];
  const functions = blueprint?.definition?.interface?.functions;
  if (!blueprint || !functions) return null;

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

  return {
    blueprintName: blueprint.name ?? '',
    version: blueprint.version ?? null,
    functions: resolveBlueprintFunctions(functions, schemasByHash),
    availableBlueprints,
  };
}
