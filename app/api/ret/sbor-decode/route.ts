import { NextRequest, NextResponse } from 'next/server';
import {
  ManifestSborStringRepresentation,
  RadixEngineToolkit,
  SerializationMode,
} from '@radixdlt/radix-engine-toolkit';
import { z } from 'zod';
import { networkIdFromName, retRequestSchema } from '../validation';

const HEX_RE = /^[0-9a-fA-F]+$/;

const bodySchema = retRequestSchema
  .extend({
    /** Legacy field (deploy-package): manifest-SBOR schema decode */
    hexEncodedSchema: z.string().regex(HEX_RE).max(4_000_000).optional(),
    /** Generic payload — kind auto-detected from the SBOR prefix byte */
    hex: z.string().regex(HEX_RE).max(4_000_000).optional(),
  })
  .refine((data) => data.hexEncodedSchema || data.hex, { message: 'hex required' });

const SCRYPTO_SBOR_PREFIX = 0x5c;
const MANIFEST_SBOR_PREFIX = 0x4d;

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const networkId = networkIdFromName(parsed.data.network);

  try {
    // Legacy deploy-package path: schema as manifest string
    if (parsed.data.hexEncodedSchema) {
      const decodedString = await RadixEngineToolkit.ManifestSbor.decodeToString(
        Buffer.from(parsed.data.hexEncodedSchema, 'hex'),
        networkId,
        ManifestSborStringRepresentation.ManifestString,
      );
      return NextResponse.json({ decodedString });
    }

    const bytes = Buffer.from(parsed.data.hex!, 'hex');
    if (bytes[0] === SCRYPTO_SBOR_PREFIX) {
      const decoded = await RadixEngineToolkit.ScryptoSbor.decodeToString(
        bytes,
        networkId,
        SerializationMode.Programmatic,
      );
      return NextResponse.json({ kind: 'scrypto', decoded });
    }
    if (bytes[0] === MANIFEST_SBOR_PREFIX) {
      const decoded = await RadixEngineToolkit.ManifestSbor.decodeToString(
        bytes,
        networkId,
        ManifestSborStringRepresentation.ManifestString,
      );
      return NextResponse.json({ kind: 'manifest', decoded });
    }
    return NextResponse.json({ error: 'Unknown SBOR prefix' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to decode payload' }, { status: 400 });
  }
}
