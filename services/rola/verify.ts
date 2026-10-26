/**
 * services/rola/verify.ts
 *
 * Stateless ROLA (Radix Off-Ledger Authentication) verification.
 *
 * Same algorithm as `@radixdlt/rola`, with two differences that the wallet
 * playground and the MCP server need:
 *   - every failure carries a reason (bad signature, key not on the ledger,
 *     address that is not the key's, …) instead of a bare yes/no;
 *   - the ledger lookup of `owner_keys` is injectable, so the same code is
 *     exercised against a resim ledger in tests and against the Gateway in
 *     production.
 *
 * A proof is valid when the signature covers
 *   blake2b256("R" ‖ challenge ‖ len(dAppDefinition) ‖ dAppDefinition ‖ origin)
 * AND the public key controls the entity: either its hash is listed in the
 * entity's `owner_keys` metadata, or (with no `owner_keys` set yet) the
 * address is the virtual address derived from that very key.
 */

import { blake2b } from 'blakejs';
import { ed25519 } from '@noble/curves/ed25519.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { PublicKey, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';

export { generateRolaChallenge } from '@/features/wallet/lib/wallet-interaction';

export type RolaCurve = 'curve25519' | 'secp256k1';
export type RolaProofType = 'account' | 'persona';

export interface RolaProof {
  type: RolaProofType;
  address: string;
  proof: { publicKey: string; signature: string; curve: RolaCurve };
}

export type RolaFailureReason =
  | 'invalidChallenge'
  | 'typeMismatch'
  | 'malformedProof'
  | 'invalidSignature'
  | 'keyNotInOwnerKeys'
  | 'addressNotDerivedFromKey'
  | 'ledgerUnavailable';

export interface RolaProofResult {
  type: RolaProofType;
  address: string;
  curve: RolaCurve;
  verified: boolean;
  reason?: RolaFailureReason;
  /** How the key was tied to the entity when the proof is valid. */
  method?: 'ownerKeys' | 'derivedAddress';
  /** blake2b-256 of the public key, last 29 bytes: what `owner_keys` lists. */
  publicKeyHash?: string;
}

/**
 * Returns the `owner_keys` hashes (hex, any case) of an entity, an empty list
 * when the metadata is not set (e.g. a virtual entity never used on-ledger),
 * or throws when the ledger cannot be read.
 */
export type OwnerKeysLookup = (address: string) => Promise<string[]>;

export interface VerifyRolaInput {
  networkId: number;
  dAppDefinitionAddress: string;
  origin: string;
  challenge: string;
  proofs: RolaProof[];
  ownerKeys: OwnerKeysLookup;
}

const HEX_32_BYTES = /^[0-9a-f]{64}$/i;

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) throw new Error('not hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** The 32-byte hash the wallet signs for a ROLA challenge, as hex. */
export function rolaSignatureMessage(
  challenge: string,
  dAppDefinitionAddress: string,
  origin: string,
): string {
  const encoder = new TextEncoder();
  const dApp = encoder.encode(dAppDefinitionAddress);
  const parts = [
    encoder.encode('R'),
    hexToBytes(challenge),
    Uint8Array.of(dApp.length),
    dApp,
    encoder.encode(origin),
  ];
  const message = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    message.set(part, offset);
    offset += part.length;
  }
  return bytesToHex(blake2b(message, undefined, 32));
}

/** Hash listed in `owner_keys` for a public key. */
export function publicKeyHash(publicKeyHex: string): string {
  return bytesToHex(blake2b(hexToBytes(publicKeyHex), undefined, 32).subarray(-29));
}

function signatureIsValid(proof: RolaProof['proof'], messageHex: string): boolean {
  const message = hexToBytes(messageHex);
  const publicKey = hexToBytes(proof.publicKey);
  if (proof.curve === 'curve25519') {
    return ed25519.verify(hexToBytes(proof.signature), message, publicKey);
  }
  // The wallet prefixes the secp256k1 signature with its recovery byte, and
  // signs the blake2b hash itself: no sha256 on top of it.
  return secp256k1.verify(hexToBytes(proof.signature.slice(2)), message, publicKey, { prehash: false });
}

async function derivedAddress(proof: RolaProof, networkId: number): Promise<string> {
  const key =
    proof.proof.curve === 'curve25519'
      ? new PublicKey.Ed25519(proof.proof.publicKey)
      : new PublicKey.Secp256k1(proof.proof.publicKey);
  return proof.type === 'persona'
    ? RadixEngineToolkit.Derive.virtualIdentityAddressFromPublicKey(key, networkId)
    : RadixEngineToolkit.Derive.virtualAccountAddressFromPublicKey(key, networkId);
}

async function verifyOne(
  proof: RolaProof,
  messageHex: string,
  input: VerifyRolaInput,
): Promise<RolaProofResult> {
  const base = { type: proof.type, address: proof.address, curve: proof.proof.curve };
  const fail = (reason: RolaFailureReason, extra: Partial<RolaProofResult> = {}) => ({
    ...base,
    ...extra,
    verified: false,
    reason,
  });

  const expectedPrefix = proof.type === 'persona' ? 'identity_' : 'account_';
  if (!proof.address.startsWith(expectedPrefix)) return fail('typeMismatch');

  let keyHash: string;
  let signatureOk: boolean;
  try {
    keyHash = publicKeyHash(proof.proof.publicKey);
    signatureOk = signatureIsValid(proof.proof, messageHex);
  } catch {
    return fail('malformedProof');
  }
  if (!signatureOk) return fail('invalidSignature', { publicKeyHash: keyHash });

  let ownerKeys: string[];
  try {
    ownerKeys = (await input.ownerKeys(proof.address)).map((k) => k.toLowerCase());
  } catch {
    return fail('ledgerUnavailable', { publicKeyHash: keyHash });
  }

  if (ownerKeys.length > 0) {
    return ownerKeys.includes(keyHash)
      ? { ...base, verified: true, method: 'ownerKeys', publicKeyHash: keyHash }
      : fail('keyNotInOwnerKeys', { publicKeyHash: keyHash });
  }

  let derived: string;
  try {
    derived = await derivedAddress(proof, input.networkId);
  } catch {
    return fail('malformedProof', { publicKeyHash: keyHash });
  }
  return derived === proof.address
    ? { ...base, verified: true, method: 'derivedAddress', publicKeyHash: keyHash }
    : fail('addressNotDerivedFromKey', { publicKeyHash: keyHash });
}

/** Verifies every proof of a wallet response against one challenge. */
export async function verifyRolaProofs(input: VerifyRolaInput): Promise<RolaProofResult[]> {
  if (!HEX_32_BYTES.test(input.challenge)) {
    return input.proofs.map((p) => ({
      type: p.type,
      address: p.address,
      curve: p.proof.curve,
      verified: false,
      reason: 'invalidChallenge' as const,
    }));
  }
  const messageHex = rolaSignatureMessage(
    input.challenge.toLowerCase(),
    input.dAppDefinitionAddress,
    input.origin,
  );
  return Promise.all(input.proofs.map((proof) => verifyOne(proof, messageHex, input)));
}

/* ─── Proofs inside a raw wallet response ─────────────────────────────────── */

type WireProof = RolaProof['proof'];

interface WireResponseItems {
  auth?: { discriminator?: string; challenge?: string; persona?: { identityAddress?: string }; proof?: WireProof };
  oneTimeAccounts?: { challenge?: string; proofs?: Array<{ accountAddress: string; proof: WireProof }> };
  ongoingAccounts?: { challenge?: string; proofs?: Array<{ accountAddress: string; proof: WireProof }> };
  proofOfOwnership?: {
    challenge?: string;
    proofs?: Array<{ accountAddress?: string; identityAddress?: string; proof: WireProof }>;
  };
}

/**
 * Collects every signed proof of a wallet interaction response (the JSON the
 * wallet sends back, or just its `items`) with the challenge they signed.
 */
export function proofsFromWalletResponse(response: unknown): { challenge: string | null; proofs: RolaProof[] } {
  const root = (response ?? {}) as { items?: WireResponseItems } & WireResponseItems;
  const items: WireResponseItems = root.items ?? root;
  const proofs: RolaProof[] = [];
  const challenges = new Set<string>();

  const { auth } = items;
  if (auth?.discriminator === 'loginWithChallenge' && auth.proof && auth.persona?.identityAddress) {
    proofs.push({ type: 'persona', address: auth.persona.identityAddress, proof: auth.proof });
    if (auth.challenge) challenges.add(auth.challenge);
  }
  for (const accounts of [items.oneTimeAccounts, items.ongoingAccounts]) {
    if (accounts?.challenge) challenges.add(accounts.challenge);
    for (const p of accounts?.proofs ?? []) proofs.push({ type: 'account', address: p.accountAddress, proof: p.proof });
  }
  if (items.proofOfOwnership?.challenge) challenges.add(items.proofOfOwnership.challenge);
  for (const p of items.proofOfOwnership?.proofs ?? []) {
    if (p.identityAddress) proofs.push({ type: 'persona', address: p.identityAddress, proof: p.proof });
    else if (p.accountAddress) proofs.push({ type: 'account', address: p.accountAddress, proof: p.proof });
  }

  // Every item of one interaction signs the same challenge.
  const [challenge = null] = challenges;
  return { challenge: challenges.size > 1 ? null : challenge, proofs };
}
