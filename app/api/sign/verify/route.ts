import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Rola } from '@radixdlt/rola';
import { RadixNetworkId, NETWORKS } from '@/features/wallet/constants/network';
import { checkRateLimit, clientIp } from '@/services/mcp/rate-limit';
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { deriveChallenge } from '@/features/sign/lib/hash';
import { MAX_ENVELOPE_BYTES } from '@/features/sign/constants/limits';
import { radixSealAddress, RADIX_SEAL_STANDARD_KEY } from '@/features/sign/constants/seal';
import type { VerifiedSignature } from '@/features/sign/types/sign.types';

/**
 * POST /api/sign/verify
 *
 * Stateless verification of a document-attestation certificate (single or
 * multi-party). It receives ONLY the certificate JSON, never the document.
 * For each signature it checks the ROLA proof commits to the shared payload,
 * and (if on-chain) that every anchored NFT's hash matches.
 */

// ─── Input schema (strict; rejects anything unexpected) ──────────────────────

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);

const proofSchema = z.object({
  publicKey: z.string().regex(/^[0-9a-fA-F]{2,200}$/),
  signature: z.string().regex(/^[0-9a-fA-F]{2,256}$/),
  curve: z.enum(['curve25519', 'secp256k1']),
});

const signatureSchema = z
  .object({
    signerAccount: z.string().max(256),
    disclosedName: z.string().max(512).nullable(),
    disclosedEmail: z.string().max(512).nullable(),
    proof: proofSchema,
    signedAt: z.string().max(64),
  })
  .strict();

const payloadSchema = z
  .object({
    v: z.literal(1),
    docHash: hex64,
    hashAlg: z.literal('blake2b-256'),
    fileName: z.string().max(1024),
    fileSize: z.number().int().nonnegative(),
    message: z.string().max(8192),
    disclosure: z.enum(['full_name', 'surname', 'none']),
    email: z.boolean(),
    signers: z.array(z.string().max(256)).max(50),
    timestamp: z.string().max(64),
    networkId: z.number().int(),
    nonce: hex64,
  })
  .strict();

const onChainSchema = z
  .object({
    networkId: z.number().int(),
    transactionIntentHash: z.string().max(256),
    resourceAddress: z.string().max(256),
    sealAddress: z.string().max(256).optional().default(''),
    nfts: z
      .array(
        z
          .object({
            signerAccount: z.string().max(256),
            nftGlobalId: z.string().max(512),
            localId: z.string().max(64).optional(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict()
  .nullable();

const bodySchema = z
  .object({
    envelope: z
      .object({
        payload: payloadSchema,
        signatures: z.array(signatureSchema).min(1).max(50),
        onChain: onChainSchema,
      })
      .strict(),
  })
  .strict();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createRolaForNetwork(networkId: RadixNetworkId) {
  const config = NETWORKS[networkId];
  const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!expectedOrigin) throw new Error('NEXT_PUBLIC_APP_URL is not configured');
  return Rola({
    networkId: config.networkId,
    applicationName: 'Radix Community',
    dAppDefinitionAddress: config.dAppDefinitionAddress,
    expectedOrigin,
  });
}

interface NfDataResponse {
  non_fungible_ids?: Array<{
    data?: {
      programmatic_json?: {
        fields?: Array<{ field_name?: string; value?: unknown }>;
      };
    };
  }>;
}

async function verifyOnChainHash(
  network: Network,
  resourceAddress: string,
  nftLocalId: string,
  docHash: string,
): Promise<boolean> {
  try {
    const data = await gatewayPost<NfDataResponse>(
      network,
      '/state/non-fungible/data',
      { resource_address: resourceAddress, non_fungible_ids: [nftLocalId] },
    );
    const fields = data.non_fungible_ids?.[0]?.data?.programmatic_json?.fields;
    if (!Array.isArray(fields)) return false;
    const field = fields.find((f) => f.field_name === 'document_hash');
    return typeof field?.value === 'string' && field.value === docHash;
  } catch {
    return false;
  }
}

interface EntityMetadataResponse {
  items?: Array<{
    metadata?: { items?: Array<{ key: string; value?: { typed?: { value?: string } } }> };
  }>;
}

/**
 * Insignia check: the anchored collection's `radix_seal` metadata must equal
 * the official brand address for this network. Returns null when the brand is
 * not deployed on this network (nothing to check against).
 */
async function checkSealInsignia(
  network: Network,
  networkId: RadixNetworkId,
  resourceAddress: string,
): Promise<boolean | null> {
  const official = radixSealAddress(networkId);
  if (!official) return null;
  try {
    const data = await gatewayPost<EntityMetadataResponse>(
      network,
      '/state/entity/details',
      { addresses: [resourceAddress], aggregation_level: 'Global' },
    );
    const referenced = data.items?.[0]?.metadata?.items?.find(
      (m) => m.key === RADIX_SEAL_STANDARD_KEY,
    )?.value?.typed?.value;
    return referenced === official;
  } catch {
    return false;
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req.headers));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_ENVELOPE_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_certificate' }, { status: 400 });
  }
  const { envelope } = parsed.data;
  const { payload } = envelope;

  if (
    payload.networkId !== RadixNetworkId.Mainnet &&
    payload.networkId !== RadixNetworkId.Stokenet
  ) {
    return NextResponse.json({ error: 'invalid_network' }, { status: 400 });
  }

  try {
    // The challenge binds every signature to the whole (shared) payload.
    const challenge = deriveChallenge(payload);
    const rola = createRolaForNetwork(payload.networkId as RadixNetworkId);
    const openSet = payload.signers.length === 0;

    const signatures: VerifiedSignature[] = await Promise.all(
      envelope.signatures.map(async (s) => {
        const result = await rola.verifySignedChallenge({
          challenge,
          proof: s.proof,
          address: s.signerAccount,
          type: 'account',
        });
        return {
          signerAccount: s.signerAccount,
          disclosedName: s.disclosedName,
          disclosedEmail: s.disclosedEmail,
          signedAt: s.signedAt,
          valid: result.isOk(),
          required: openSet || payload.signers.includes(s.signerAccount),
        };
      }),
    );

    const allValid = signatures.every((s) => s.valid);
    const validAccounts = new Set(
      signatures.filter((s) => s.valid).map((s) => s.signerAccount),
    );
    const complete = openSet
      ? validAccounts.size > 0
      : payload.signers.every((a) => validAccounts.has(a));

    let onChainValid: boolean | null = null;
    let sealValid: boolean | null = null;
    if (envelope.onChain) {
      const network: Network =
        payload.networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
      const checks = await Promise.all(
        envelope.onChain.nfts.map((nft) => {
          const [resource, splitId] = nft.nftGlobalId.split(':');
          return verifyOnChainHash(
            network,
            resource,
            nft.localId ?? splitId ?? '#0#',
            payload.docHash,
          );
        }),
      );
      onChainValid = checks.length > 0 && checks.every(Boolean);
      sealValid = await checkSealInsignia(
        network,
        payload.networkId as RadixNetworkId,
        envelope.onChain.resourceAddress,
      );
    }

    return NextResponse.json({
      signatures,
      requiredSigners: payload.signers,
      allValid,
      complete,
      message: payload.message,
      timestamp: payload.timestamp,
      networkId: payload.networkId,
      docHash: payload.docHash,
      onChainValid,
      sealValid,
      onChain: envelope.onChain,
    });
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
