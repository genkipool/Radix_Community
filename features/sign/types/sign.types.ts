/**
 * Types for the document-signing (attestation) feature.
 *
 * Security model: the document itself NEVER leaves the browser. Only its
 * Blake2b-256 hash and small metadata are ever signed, stored or transmitted.
 * The certificate below is a self-contained, deterministically-verifiable
 * envelope; no server state is needed to verify it.
 *
 * Multi-party: every required signer signs the SAME canonical payload (hence
 * the same challenge). The envelope accumulates one entry per signer.
 */

/** How much of the signer's wallet Persona identity is disclosed (document-level policy). */
export type DisclosurePolicy = 'full_name' | 'surname' | 'none';

/** What the user downloads as the "signed file". */
export type OutputFormat = 'detached' | 'embedded';

/**
 * The canonical, signed payload. Its Blake2b-256 hash is the ROLA challenge
 * that every signer's wallet signs, so each signature commits to every field
 * here. Field order is irrelevant; verification canonicalises before hashing.
 */
export interface AttestationPayload {
  /** Envelope format version. */
  v: 1;
  /** Blake2b-256 of the original file bytes, lowercase hex (64 chars). */
  docHash: string;
  /** Hash algorithm identifier (fixed for now). */
  hashAlg: 'blake2b-256';
  /** Original file name (bound into the signature, informational). */
  fileName: string;
  /** Original file size in bytes. */
  fileSize: number;
  /** Optional message the initiator attached (empty string if none). */
  message: string;
  /** Identity disclosure policy every signer follows (name). */
  disclosure: DisclosurePolicy;
  /** Whether each signer's wallet email is requested/disclosed. */
  email: boolean;
  /**
   * Required signer accounts. Empty = single/open (any one signature suffices).
   * Non-empty = every listed account must sign for the certificate to complete.
   */
  signers: string[];
  /** ISO-8601 timestamp the document was created by the initiator. */
  timestamp: string;
  /** Radix network id: 1 = Mainnet, 2 = Stokenet. */
  networkId: number;
  /** Random 32-byte hex nonce, so identical documents get distinct challenges. */
  nonce: string;
}

/** ROLA signature proof as returned by the Radix wallet. */
export interface SignatureProof {
  publicKey: string;
  signature: string;
  curve: 'curve25519' | 'secp256k1';
}

/** One signer's contribution to the certificate. */
export interface SignatureEntry {
  /** Account that produced this signature. */
  signerAccount: string;
  /** Disclosed name per the document policy, or null. */
  disclosedName: string | null;
  /** Disclosed wallet email, or null. */
  disclosedEmail: string | null;
  proof: SignatureProof;
  /** ISO-8601 timestamp this signer signed. */
  signedAt: string;
}

/** A single minted attestation NFT, tied to the signer that holds it. */
export interface OnChainNft {
  signerAccount: string;
  /** Non-fungible global id, e.g. `resource_...:#0#`. */
  nftGlobalId: string;
}

/**
 * On-chain anchoring info. A single atomic transaction mints one independent
 * NFT per signer, so `nfts` has one entry per signer.
 */
export interface OnChainAnchor {
  networkId: number;
  transactionIntentHash: string;
  /** Resource address of the minted attestation NFT collection. */
  resourceAddress: string;
  nfts: OnChainNft[];
}

/**
 * The full certificate. This is what gets serialised to
 * `<file>.radixsig.json` (or embedded into the PDF) and passed between signers.
 */
export interface AttestationEnvelope {
  payload: AttestationPayload;
  /** One entry per signer that has signed so far. */
  signatures: SignatureEntry[];
  onChain: OnChainAnchor | null;
}

/** Result of a successful signing, returned to the UI for download. */
export interface SignResult {
  envelope: AttestationEnvelope;
  /** Original file bytes, kept in memory only for the download step. */
  fileBytes: Uint8Array;
  fileName: string;
  fileType: string;
}

/** Per-signer verification detail. */
export interface VerifiedSignature {
  signerAccount: string;
  disclosedName: string | null;
  disclosedEmail: string | null;
  signedAt: string;
  /** The ROLA proof is valid and commits to the shared payload. */
  valid: boolean;
  /** This account is part of the required signer set (or the set is open). */
  required: boolean;
}

/** Server verification response. */
export interface VerifyResult {
  signatures: VerifiedSignature[];
  /** Required signer accounts declared in the payload (empty = open). */
  requiredSigners: string[];
  /** Every present signature is cryptographically valid. */
  allValid: boolean;
  /** All required signers have a valid signature (or, if open, at least one). */
  complete: boolean;
  message: string;
  timestamp: string;
  networkId: number;
  docHash: string;
  /**
   * On-chain state:
   *  - null  → certificate is off-chain only
   *  - true  → the anchored NFTs exist on-ledger and their hash matches
   *  - false → missing or hash mismatch (tampering)
   */
  onChainValid: boolean | null;
  onChain: OnChainAnchor | null;
}
