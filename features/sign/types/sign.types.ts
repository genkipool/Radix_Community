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

/**
 * Optional issuer identity published — locked — in the metadata of the
 * on-ledger request/badge/signature resources, so wallets and explorers show
 * who is behind a signing request. Everything here is public and permanent.
 */
export interface IssuerMeta {
  /** Company / organisation name. */
  orgName?: string;
  /** Organisation website (Url metadata). */
  orgWebsite?: string;
  /** Logo URL — used as `icon_url` and as each NFT's image. */
  orgLogoUrl?: string;
}

/** How the on-ledger multi-party request enforces who can sign. */
export type OnChainRequestMode = 'standard' | 'strict';

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

/**
 * Identity of the X.509 certificate a signer used for the optional PAdES
 * signature, recorded so it TRAVELS with the certificate: co-signing rebuilds
 * the PDF from the original, which drops the previous PAdES signature, and
 * without this the earlier signer's certificate would vanish from the record.
 *
 * Informational only. Unlike the ROLA proof, it is not cryptographically bound
 * to anything, so it is displayed as a record of what the signer used — only
 * the PDF's CURRENT signature is validated by the reader.
 */
export interface SignerCertificate {
  subjectCN: string;
  subjectO: string;
  issuer: string;
  serialNumber: string;
  /** ISO-8601 validity window. */
  validFrom: string;
  validTo: string;
}

/** One signer's contribution to the certificate. */
export interface SignatureEntry {
  /** Account that produced this signature. */
  signerAccount: string;
  /** Disclosed name per the document policy, or null. */
  disclosedName: string | null;
  /** Disclosed wallet email, or null. */
  disclosedEmail: string | null;
  /**
   * ROLA proof for OFF-ledger signatures. `null` for ON-ledger signatures,
   * whose proof is the signer's on-chain signature NFT (verified via the chain
   * of custody instead of a ROLA challenge).
   */
  proof: SignatureProof | null;
  /** ISO-8601 timestamp this signer signed. */
  signedAt: string;
  /** X.509 certificate this signer also signed the PDF with, if any. */
  certificate?: SignerCertificate;
  /**
   * OFF-ledger signatures: an RFC 3161 timestamp token (base64 DER) in which a
   * Time Stamping Authority attests that this signature already existed at a
   * given moment. It is what makes `signedAt` checkable — without it the date is
   * whatever the signer's browser said, and a certificate could claim any.
   * Absent when the authority was unreachable; on-ledger signatures do not carry
   * one, their clock is the transaction that minted them.
   */
  timeStampToken?: string;
}

/** A single minted attestation NFT, tied to the signer that holds it. */
export interface OnChainNft {
  signerAccount: string;
  /** Non-fungible global id, e.g. `resource_...:#3#`. */
  nftGlobalId: string;
  /** Local id only, e.g. `#3#` (the collection resource is `resourceAddress`). */
  localId: string;
}

/**
 * On-chain anchoring info. The attestation is minted into the anchoring
 * account's Radix Seal collection (one resource per user, a new id per
 * document), so `resourceAddress` is that collection and `nfts` lists the
 * minted ids.
 */
export interface OnChainAnchor {
  networkId: number;
  transactionIntentHash: string;
  /** The account's Radix Seal attestation collection resource. */
  resourceAddress: string;
  /** Radix Seal brand address referenced by the collection ('' if undeployed). */
  sealAddress: string;
  nfts: OnChainNft[];
}

/**
 * The full certificate. This is what gets serialised to
 * `<file>.radixsig.json` (or embedded into the PDF) and passed between signers.
 */
/** Reference to the on-ledger signing request that defines the required set. */
export interface OnChainRequestRef {
  networkId: number;
  /** Request key: `<initiator collection>:#<firstId>#`. */
  requestId: string;
}

export interface AttestationEnvelope {
  payload: AttestationPayload;
  /** One entry per signer that has signed so far. */
  signatures: SignatureEntry[];
  onChain: OnChainAnchor | null;
  /**
   * On-ledger certificates only: the request whose locked invitation batch is
   * the AUTHORITATIVE required-signer list. Verification re-resolves it from the
   * ledger, so the certificate cannot understate who had to sign.
   */
  request?: OnChainRequestRef | null;
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
  /**
   * The independent clock for this signature, read back from the ledger (the
   * transaction that minted it) or from its RFC 3161 token. Null when the
   * signature offers neither, in which case its date rests on nothing.
   */
  anchoredAt: string | null;
  /** Where `anchoredAt` came from, so the UI can say which clock it is. */
  anchorSource: 'ledger' | 'timestamp' | null;
  /**
   * Whether the declared `signedAt` agrees with `anchoredAt`. Null when there
   * is no anchor. False means the certificate states a time that the
   * independent clock contradicts — a backdated date, typically.
   */
  signedAtAnchored: boolean | null;
  /**
   * Whether the `issued_at` written inside the on-ledger signature NFT agrees
   * with the commit time of the transaction that minted it. A mint cannot carry
   * its own consensus time, so that field is always a claim; this says whether
   * the claim survives contact with the ledger. Null when there is no on-ledger
   * NFT, or when it records no date at all.
   */
  issuedAtAnchored: boolean | null;
  /** Authority that issued the timestamp token, for display. */
  timestampAuthority?: string | null;
  /** The token is valid but its anchor is not one this deployment knows. */
  timestampUntrustedAnchor?: boolean;
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
  /**
   * Radix Seal insignia check:
   *  - null  → not anchored, or brand not deployed on this network
   *  - true  → the anchored collection references the official Radix Seal
   *  - false → collection present but does NOT reference the official brand
   */
  sealValid: boolean | null;
  onChain: OnChainAnchor | null;
  /**
   * Whether any valid ROLA proof commits to the payload. When true the message,
   * file name and document timestamp are cryptographically bound to a signer.
   * When false (a purely on-ledger certificate) the ledger binds the signer and
   * the document hash and NOTHING else: those fields are then merely declared,
   * and the UI must not present them as if the signature covered them.
   */
  payloadBound: boolean;
  /**
   * Where the authoritative required-signer set came from:
   *  - 'typed'       → a request key the verifier supplied (the strongest: it
   *                    cannot be chosen by whoever produced the certificate)
   *  - 'certificate' → the request the certificate points at
   *  - 'none'        → no on-ledger request; the payload's own signer list
   */
  requestSource: 'typed' | 'certificate' | 'none';
  /**
   * The certificate points at a DIFFERENT request than the one the verifier
   * supplied. The supplied key wins, and this says the certificate tried to be
   * measured against another yardstick.
   */
  requestMismatch: boolean;
  /**
   * Whether the document's declared creation time can be true: it must not come
   * after the moment the network recorded a signature of it. Null when nothing
   * independent dates any signature, or the declared time is unparseable.
   */
  createdAtCoherent: boolean | null;
}
