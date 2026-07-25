import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Rola } from '@radixdlt/rola';
import { RadixNetworkId, NETWORKS } from '@/features/wallet/constants/network';
import { checkRateLimit, clientIp } from '@/services/mcp/rate-limit';
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { deriveChallenge } from '@/features/sign/lib/hash';
import {
  collectionOwnedByAccount,
  entityDetails,
  resolveSealRequest,
  signerHasSigned,
} from '@/features/sign/lib/onchain-custody';
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

/**
 * Optional record of the X.509 certificate a signer used for the PDF's PAdES
 * signature. Purely informational: it is NOT part of any verification (the ROLA
 * proof does not commit to it), it only has to be accepted so certificates
 * carrying it still validate.
 */
const signerCertificateSchema = z
  .object({
    subjectCN: z.string().max(256),
    subjectO: z.string().max(256),
    issuer: z.string().max(256),
    serialNumber: z.string().max(128),
    validFrom: z.string().max(64),
    validTo: z.string().max(64),
  })
  .strict();

const signatureSchema = z
  .object({
    signerAccount: z.string().max(256),
    disclosedName: z.string().max(512).nullable(),
    disclosedEmail: z.string().max(512).nullable(),
    // Off-ledger signatures carry a ROLA proof; on-ledger ones set it null and
    // are verified via their on-chain signature NFT (chain of custody).
    proof: proofSchema.nullable(),
    signedAt: z.string().max(64),
    certificate: signerCertificateSchema.optional(),
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

const requestSchema = z
  .object({
    networkId: z.number().int(),
    requestId: z.string().max(600),
  })
  .strict()
  .nullable()
  .optional();

const bodySchema = z
  .object({
    envelope: z
      .object({
        payload: payloadSchema,
        signatures: z.array(signatureSchema).min(1).max(50),
        onChain: onChainSchema,
        request: requestSchema,
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
    // The challenge binds every off-ledger signature to the whole payload.
    const challenge = deriveChallenge(payload);
    const rola = createRolaForNetwork(payload.networkId as RadixNetworkId);
    const network: Network =
      payload.networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
    const officialSeal = radixSealAddress(payload.networkId as RadixNetworkId);

    // Authoritative required-signer set. For on-ledger certificates that
    // reference their request, re-resolve it from the IMMUTABLE invitation batch
    // so the certificate cannot understate who had to sign. Otherwise use the
    // payload list (which the ROLA challenge already binds for off-ledger certs).
    let requiredSigners: string[] = payload.signers;
    // A certificate that references an on-ledger request stands or falls with
    // it: if the request cannot be resolved (bogus key, or an invitation was
    // burned on a legacy collection to shrink the quorum), completion is
    // DENIED rather than falling back to the certificate's own signer list.
    let requestResolved = true;
    if (envelope.request) {
      const resolved = await resolveSealRequest(network, envelope.request.requestId);
      if (resolved && resolved.docHash === payload.docHash) {
        requiredSigners = resolved.requiredSigners;
      } else {
        requestResolved = false;
      }
    }
    const openSet = requiredSigners.length === 0;

    const signatures: VerifiedSignature[] = await Promise.all(
      envelope.signatures.map(async (s) => {
        // Off-ledger signature → ROLA proof over the payload challenge.
        // On-ledger signature (proof === null) → the signer's on-chain
        // signature NFT in their Seal-owned collection (chain of custody), AND
        // — permission — the signer must be among the invited/required signers
        // (anyone can mint an NFT for any hash, so an uninvited one must not
        // count). Open sets (no required list) accept any valid signer.
        const invited = openSet || requiredSigners.includes(s.signerAccount);
        const valid = s.proof
          ? (
              await rola.verifySignedChallenge({
                challenge,
                proof: s.proof,
                address: s.signerAccount,
                type: 'account',
              })
            ).isOk()
          : invited &&
            (await signerHasSigned(network, s.signerAccount, payload.docHash, officialSeal));
        return {
          signerAccount: s.signerAccount,
          disclosedName: s.disclosedName,
          disclosedEmail: s.disclosedEmail,
          signedAt: s.signedAt,
          valid,
          required: openSet || requiredSigners.includes(s.signerAccount),
        };
      }),
    );

    const allValid = signatures.every((s) => s.valid);
    const validAccounts = new Set(
      signatures.filter((s) => s.valid).map((s) => s.signerAccount),
    );
    const complete =
      requestResolved &&
      (openSet
        ? validAccounts.size > 0
        : requiredSigners.every((a) => validAccounts.has(a)));

    let onChainValid: boolean | null = null;
    let sealValid: boolean | null = null;
    if (envelope.onChain) {
      const onChain = envelope.onChain;
      // Chain of custody: the anchored collection must PROVABLY belong to the
      // account that anchored it, and that account must be a valid signer.
      // Without this a forger could point the certificate at any collection
      // whose NFT merely carries the same document hash.
      const [collectionItem] = await entityDetails(network, [
        onChain.resourceAddress,
      ]);
      const checks = await Promise.all(
        onChain.nfts.map(async (nft) => {
          // The anchoring account must be a valid ROLA signer either way.
          if (!validAccounts.has(nft.signerAccount)) return false;
          // Unified model: a signature NFT lives in the signer's Seal-owned
          // collection (owner = the OFFICIAL Radix Seal, in the signer's
          // account). This is the strongest binding.
          if (
            await signerHasSigned(network, nft.signerAccount, payload.docHash, officialSeal)
          ) {
            return true;
          }
          // Legacy attestation: collection owned by the signer's account
          // signature badge, with a matching document hash. Kept so previously
          // anchored certificates still verify during the migration.
          const localId = nft.localId ?? nft.nftGlobalId.split(':')[1] ?? '#0#';
          const hashOk = await verifyOnChainHash(
            network,
            onChain.resourceAddress,
            localId,
            payload.docHash,
          );
          const ownerOk = await collectionOwnedByAccount(
            collectionItem,
            nft.signerAccount,
            payload.networkId,
          );
          return hashOk && ownerOk;
        }),
      );
      onChainValid = checks.length > 0 && checks.every(Boolean);
      sealValid = await checkSealInsignia(
        network,
        payload.networkId as RadixNetworkId,
        onChain.resourceAddress,
      );
    } else if (envelope.request) {
      // On-ledger multi-party certificate: each valid signer records their
      // signature as an NFT in their OWN Seal collection. Confirm each via the
      // chain of custody (owner = the OFFICIAL Radix Seal, in the signer's
      // account) — the same infalsifiable check as the anchored case.
      const anchored = await Promise.all(
        [...validAccounts].map((acc) =>
          signerHasSigned(network, acc, payload.docHash, officialSeal),
        ),
      );
      onChainValid = anchored.length > 0 && anchored.every(Boolean);
      // The custody check above already requires the official Seal.
      sealValid = officialSeal ? onChainValid : null;
    }

    return NextResponse.json({
      signatures,
      requiredSigners,
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
