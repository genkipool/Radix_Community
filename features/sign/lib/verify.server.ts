/**
 * Server-side Single Source of Truth for verifying a Radix Seal
 * document-attestation certificate (`.radixsig.json`, single or multi-party).
 *
 * Shared directly by:
 *   - `POST /api/sign/verify` (Web UI)
 *   - `verify_document_signature` (MCP tool)
 *
 * Stateless: receives ONLY the certificate envelope, never the document bytes.
 * For each signature it checks the ROLA proof commits to the shared payload,
 * and (if on-chain) that every anchored NFT satisfies the chain of custody and
 * carries the matching document hash.
 */

import { z } from 'zod';
import { Rola } from '@radixdlt/rola';
import { RadixNetworkId, NETWORKS } from '@/features/wallet/constants/network';
import type { Network } from '@/services/gateway/client';
import { deriveChallenge } from './hash';
import {
  DOC_HASH_HEX_RE,
  isSupportedNetworkId,
  networkNameForId,
  splitNftGlobalId,
} from './network';
import {
  collectionOwnedByAccount,
  entityDetails,
  findSignerSignatures,
  ledgerTimestamp,
  metadataString,
  nfData,
  resolveSealRequest,
  type SignerSignature,
} from './onchain-custody';
import { radixSealAddress, RADIX_SEAL_STANDARD_KEY } from '../constants/seal';
import {
  instantOf,
  issuedAtAgrees,
  MAX_TOKEN_BASE64,
  SIGNED_AT_TOLERANCE_MS,
  sha256Hex,
  signedAtAgrees,
  timestampImprintInput,
} from './timestamp';
import { verifyTimeStampTokenBase64 } from './tsa-verify';
import type {
  OnChainAnchor,
  VerifiedSignature,
  VerifyResult,
} from '../types/sign.types';

// ─── Input schema (strict; rejects anything unexpected) ──────────────────────

const hex64 = z.string().regex(DOC_HASH_HEX_RE);

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
    /** RFC 3161 timestamp token (base64 DER) attesting when this signature
     *  existed. Verified below against this signature's own imprint. */
    timeStampToken: z.string().max(MAX_TOKEN_BASE64).optional(),
    /**
     * Pointer to the transaction that minted an on-ledger signature. Accepted
     * so certificates carrying it validate; never read here — the signature is
     * re-found through the chain of custody, which no pointer can influence.
     */
    transactionIntentHash: z.string().max(256).optional(),
    /**
     * Pointer to the signature NFT of an on-ledger signature. Accepted for the
     * same reason as the intent hash above, and read for the same reason not at
     * all: the NFT is re-found through the chain of custody.
     */
    signatureNft: z.string().max(512).optional(),
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
    /** Informational pointer to the transaction that created the request. */
    transactionIntentHash: z.string().max(256).optional(),
  })
  .strict()
  .nullable()
  .optional();

export const verifyBodySchema = z
  .object({
    envelope: z
      .object({
        payload: payloadSchema,
        signatures: z.array(signatureSchema).min(1).max(50),
        onChain: onChainSchema,
        request: requestSchema,
      })
      .strict(),
    /**
     * A request key the VERIFIER supplied (typed in, or carried by the shared
     * link). It outranks the certificate's own: a certificate names the request
     * it wants to be measured against, so left to itself it can point at one
     * whose invitation batch lists nobody it has not already collected.
     */
    requestOverride: requestSchema,
  })
  .strict();

export type VerifyBodyInput = z.infer<typeof verifyBodySchema>;

export class VerifyCertificateError extends Error {
  constructor(
    public readonly code: 'invalid_network' | 'missing_origin',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'VerifyCertificateError';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createRolaForNetwork(
  networkId: RadixNetworkId,
  fallbackOrigin?: string,
) {
  const config = NETWORKS[networkId];
  const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin;
  if (!expectedOrigin) {
    throw new VerifyCertificateError(
      'missing_origin',
      'NEXT_PUBLIC_APP_URL is not configured',
    );
  }
  return Rola({
    networkId: config.networkId,
    applicationName: 'Radix Community',
    dAppDefinitionAddress: config.dAppDefinitionAddress,
    expectedOrigin,
  });
}

async function verifyOnChainHash(
  network: Network,
  resourceAddress: string,
  nftLocalId: string,
  docHash: string,
): Promise<boolean> {
  try {
    const records = await nfData(network, resourceAddress, [nftLocalId]);
    return records.get(nftLocalId)?.document_hash === docHash;
  } catch {
    return false;
  }
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
    const [item] = await entityDetails(network, [resourceAddress]);
    return metadataString(item, RADIX_SEAL_STANDARD_KEY) === official;
  } catch {
    return false;
  }
}

// ─── Verification SSoT ───────────────────────────────────────────────────────

export async function verifyCertificateEnvelope(
  input: VerifyBodyInput,
  options?: { expectedOrigin?: string },
): Promise<VerifyResult> {
  const { envelope, requestOverride } = input;
  const { payload } = envelope;

  if (!isSupportedNetworkId(payload.networkId)) {
    throw new VerifyCertificateError('invalid_network');
  }

  const networkId = payload.networkId;
  // The challenge binds every off-ledger signature to the whole payload.
  const challenge = deriveChallenge(payload);
  const rola = createRolaForNetwork(networkId, options?.expectedOrigin);
  const network: Network = networkNameForId(networkId);
  const officialSeal = radixSealAddress(networkId);

  /*
   * Authoritative required-signer set, re-resolved from the IMMUTABLE
   * invitation batch so a certificate cannot understate who had to sign.
   *
   * WHICH request is resolved matters as much as resolving one. A certificate
   * names its own, and anyone can mint a signing collection and a one-name
   * invitation batch into it, so a certificate left to choose freely can point
   * at a request that requires only the signer it already has. A key supplied
   * by the verifier — typed in, or read from the link the issuer shared —
   * therefore wins outright, and a certificate pointing somewhere else is
   * flagged rather than quietly overridden.
   */
  const effectiveRequest = requestOverride ?? envelope.request ?? null;
  const requestSource: 'typed' | 'certificate' | 'none' = requestOverride
    ? 'typed'
    : envelope.request
      ? 'certificate'
      : 'none';
  const requestMismatch =
    !!requestOverride &&
    !!envelope.request &&
    requestOverride.requestId.trim() !== envelope.request.requestId.trim();

  /*
   * With no on-ledger request to resolve, the certificate's OWN signature list
   * is the required set.
   *
   * A single-signer document declares no signer set — there was nobody to
   * invite — and treating that as "open" meant any account holding a signature
   * for the same hash satisfied it, and that one valid signature made the
   * whole certificate `complete`. Nothing was forgeable that way, but
   * "complete" stopped meaning what a reader takes it to mean. Closing the set
   * around whoever the certificate names says it plainly: these signed, and
   * `complete` requires all of them.
   */
  let requiredSigners: string[] = payload.signers.length
    ? payload.signers
    : [...new Set(envelope.signatures.map((s) => s.signerAccount))];
  // A certificate measured against an on-ledger request stands or falls with
  // it: if the request cannot be resolved (bogus key, or an invitation was
  // burned on a legacy collection to shrink the quorum), completion is
  // DENIED rather than falling back to the certificate's own signer list.
  let requestResolved = true;
  if (effectiveRequest) {
    const resolved = await resolveSealRequest(network, effectiveRequest.requestId);
    if (resolved && resolved.docHash === payload.docHash) {
      requiredSigners = resolved.requiredSigners;
    } else {
      requestResolved = false;
    }
  }
  const openSet = requiredSigners.length === 0;

  /*
   * On-ledger signature lookups, resolved once per account. The same account
   * is asked about by the per-signature loop, by the anchoring checks and by
   * the multi-party branch below, and each lookup is several Gateway round
   * trips over that account's whole NFT holdings.
   */
  const lookups = new Map<string, Promise<SignerSignature[]>>();
  const lookupSignatures = (account: string): Promise<SignerSignature[]> => {
    const cached = lookups.get(account);
    if (cached) return cached;
    const pending = findSignerSignatures(
      network,
      account,
      payload.docHash,
      officialSeal,
    );
    lookups.set(account, pending);
    return pending;
  };

  /*
   * Which of an account's signature mints this certificate is talking about.
   *
   * Signing the same document twice is ordinary — a correction, a second
   * round — and leaves several mints that all satisfy the chain of custody.
   * Dating a certificate from an arbitrary one is how a signature made
   * minutes ago gets reported against a mint from a fortnight back, and the
   * certificate then called a liar for saying otherwise. So the mint that
   * AGREES with the declared time wins; only when none does is the claim
   * genuinely uncorroborated, and the earliest then stands as what the ledger
   * does say.
   */
  const matchSignature = async (
    candidates: SignerSignature[],
    declaredAt: string,
  ): Promise<{ record: SignerSignature; committedAt: string | null } | null> => {
    let fallback: { record: SignerSignature; committedAt: string | null } | null =
      null;
    for (const record of candidates) {
      const committedAt = await ledgerTimestamp(network, record.stateVersion);
      if (!fallback) fallback = { record, committedAt };
      if (committedAt && signedAtAgrees(declaredAt, committedAt)) {
        return { record, committedAt };
      }
    }
    return fallback;
  };

  const signatures: VerifiedSignature[] = await Promise.all(
    envelope.signatures.map(async (s) => {
      // Off-ledger signature → ROLA proof over the payload challenge.
      // On-ledger signature (proof === null) → the signer's on-chain
      // signature NFT in their Seal-owned collection (chain of custody), AND
      // — permission — the signer must be among the invited/required signers
      // (anyone can mint an NFT for any hash, so an uninvited one must not
      // count). Open sets (no required list) accept any valid signer.
      const invited = openSet || requiredSigners.includes(s.signerAccount);
      const onLedger = s.proof ? [] : await lookupSignatures(s.signerAccount);
      const valid = s.proof
        ? (
            await rola.verifySignedChallenge({
              challenge,
              proof: s.proof,
              address: s.signerAccount,
              type: 'account',
            })
          ).isOk()
        : invited && onLedger.length > 0;

      /*
       * When this signature happened, according to something other than the
       * certificate. Off-ledger that is the authority's genTime, valid only
       * once the token is shown to cover THIS signature; on-ledger it is the
       * consensus time of the transaction that minted it. Either way the
       * declared `signedAt` becomes a claim that can be contradicted, which is
       * the whole point: it used to be a claim nothing could touch.
       */
      let anchoredAt: string | null = null;
      let anchorSource: 'ledger' | 'timestamp' | null = null;
      let timestampAuthority: string | null = null;
      let timestampUntrustedAnchor = false;

      // The LEDGER first whenever the signature lives there — including the
      // anchored single-sign flow, whose signatures DO carry a ROLA proof.
      // Both clocks are honest and seconds apart, but the ledger's is the one
      // this product rests on, the one the signed PDF prints and the one a
      // reader can check on any explorer, so the two never show two dates.
      // Only asked for when the certificate claims an on-ledger side, so a
      // purely off-ledger one costs no Gateway round trip.
      let issuedAtAnchored: boolean | null = null;
      if (valid && (onLedger.length > 0 || envelope.onChain || effectiveRequest)) {
        const candidates =
          onLedger.length > 0 ? onLedger : await lookupSignatures(s.signerAccount);
        const matched = await matchSignature(candidates, s.signedAt);
        if (matched?.committedAt) {
          anchoredAt = matched.committedAt;
          anchorSource = 'ledger';
          // The NFT states its own date. It was written a moment before the
          // transaction committed, so it should sit right beside the
          // consensus time; a record whose `issued_at` says otherwise is
          // contradicting the ledger it lives on.
          issuedAtAnchored = issuedAtAgrees(
            matched.record.issuedAt,
            matched.committedAt,
          );
        }
      }
      if (!anchoredAt && valid && s.proof && s.timeStampToken) {
        const imprint = await sha256Hex(
          timestampImprintInput(s.signerAccount, challenge, s.proof.signature),
        );
        const check = verifyTimeStampTokenBase64(s.timeStampToken, imprint);
        if (check.valid && check.genTime) {
          anchoredAt = check.genTime;
          anchorSource = 'timestamp';
          timestampAuthority = check.authority;
          timestampUntrustedAnchor = !check.trusted;
        }
      }

      return {
        signerAccount: s.signerAccount,
        disclosedName: s.disclosedName,
        disclosedEmail: s.disclosedEmail,
        signedAt: s.signedAt,
        valid,
        required: openSet || requiredSigners.includes(s.signerAccount),
        anchoredAt,
        anchorSource,
        signedAtAnchored: signedAtAgrees(s.signedAt, anchoredAt),
        issuedAtAnchored,
        timestampAuthority,
        timestampUntrustedAnchor,
      };
    }),
  );

  /*
   * A document cannot be created after it was signed.
   *
   * `payload.timestamp` is the one date a ROLA proof does commit to, which
   * makes it unalterable by a third party but says nothing about whether the
   * signer's own machine told the truth when it wrote it. It has one hard
   * relation to something independent: it must not come AFTER the moment the
   * network recorded the signature. Anything else is a spread a legitimate
   * signing can produce (a document circulated for days before anyone signs).
   */
  const earliestAnchor = signatures
    .filter((s) => s.valid && s.anchoredAt)
    .map((s) => Date.parse(s.anchoredAt!))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0];
  const createdInstant = instantOf(payload.timestamp);
  const createdAtCoherent =
    earliestAnchor === undefined || createdInstant === null
      ? null
      : createdInstant <= earliestAnchor + SIGNED_AT_TOLERANCE_MS;

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
        if ((await lookupSignatures(nft.signerAccount)).length > 0) return true;
        // Legacy attestation: collection owned by the signer's account
        // signature badge, with a matching document hash. Kept so previously
        // anchored certificates still verify during the migration.
        const localId =
          nft.localId ??
          (nft.nftGlobalId.includes(':')
            ? splitNftGlobalId(nft.nftGlobalId).localId
            : '#0#');
        const hashOk = await verifyOnChainHash(
          network,
          onChain.resourceAddress,
          localId,
          payload.docHash,
        );
        const ownerOk = await collectionOwnedByAccount(
          collectionItem,
          nft.signerAccount,
          networkId,
        );
        return hashOk && ownerOk;
      }),
    );
    onChainValid = checks.length > 0 && checks.every(Boolean);
    sealValid = await checkSealInsignia(
      network,
      networkId,
      onChain.resourceAddress,
    );
  } else if (envelope.request) {
    // On-ledger multi-party certificate: each valid signer records their
    // signature as an NFT in their OWN Seal collection. Confirm each via the
    // chain of custody (owner = the OFFICIAL Radix Seal, in the signer's
    // account) — the same infalsifiable check as the anchored case.
    const anchored = await Promise.all(
      [...validAccounts].map(async (acc) => (await lookupSignatures(acc)).length > 0),
    );
    onChainValid = anchored.length > 0 && anchored.every(Boolean);
    // The custody check above already requires the official Seal.
    sealValid = officialSeal ? onChainValid : null;
  }

  const normalizedOnChain: OnChainAnchor | null = envelope.onChain
    ? {
        ...envelope.onChain,
        nfts: envelope.onChain.nfts.map((nft) => ({
          signerAccount: nft.signerAccount,
          nftGlobalId: nft.nftGlobalId,
          localId:
            nft.localId ??
            (nft.nftGlobalId.includes(':')
              ? splitNftGlobalId(nft.nftGlobalId).localId
              : ''),
        })),
      }
    : null;

  return {
    signatures,
    requiredSigners,
    allValid,
    complete,
    message: payload.message,
    timestamp: payload.timestamp,
    networkId,
    docHash: payload.docHash,
    onChainValid,
    sealValid,
    onChain: normalizedOnChain,
    // Only a valid ROLA proof commits to the payload. Without one the ledger
    // ties the signer to the document hash and to nothing else, so the
    // message, file name and document date are declarations, not evidence.
    payloadBound: envelope.signatures.some(
      (s, index) => !!s.proof && signatures[index].valid,
    ),
    requestSource,
    requestMismatch,
    createdAtCoherent,
  };
}
