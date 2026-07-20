# Radix Seal

Radix Seal is an open, self custody standard for signing, encrypting and
exchanging documents on the Radix Network. It turns the Radix Wallet into your
own certificate authority: you issue, and the public ledger attests. There is no
company in the middle that stores your files, and no party anyone has to trust
for a signature to remain verifiable.

This document explains, in full detail, what Radix Seal is, what it does, how it
does it, and how it works, including the exact on ledger conventions so that any
third party can implement or verify it independently.

## Table of contents

1. [Overview](#1-overview)
2. [Design principles](#2-design-principles)
3. [The NFTs](#3-the-nfts)
4. [Metadata and data conventions (the standard)](#4-metadata-and-data-conventions-the-standard)
5. [Signing a document](#5-signing-a-document)
6. [Encrypting a document](#6-encrypting-a-document)
7. [Secure chat](#7-secure-chat)
8. [Verification](#8-verification)
9. [File formats](#9-file-formats)
10. [Sharing and peer to peer transport](#10-sharing-and-peer-to-peer-transport)
11. [The brand resource and its admin badge](#11-the-brand-resource-and-its-admin-badge)
12. [Threat model and what cannot be forged](#12-threat-model-and-what-cannot-be-forged)
13. [Honest scope and limits](#13-honest-scope-and-limits)
14. [Glossary](#14-glossary)

---

## 1. Overview

Radix Seal is defined by a small set of public metadata conventions and NFT data
shapes on the Radix ledger. Any wallet, explorer or third party tool can
implement it without permission: discover a signer's collection, check its
insignia and verify its signatures. There is no proprietary format and no
central server in the trust path.

It powers three self custody tools that all share the same wallet derived trust
model:

- **Sign document**: prove authorship and integrity of any file, alone or with
  several people, off chain or anchored on the ledger.
- **Encrypt document**: lock a file to an account and share it peer to peer,
  optionally gating decryption to on ledger authorized accounts.
- **Secure chat**: end to end encrypted conversations where both sides prove who
  they are with their wallet.

The file itself never leaves the browser. Only what is strictly needed to verify
(a hash and account addresses) is ever anchored on chain.

---

## 2. Design principles

**Privacy by design.** Hashing, encryption, decryption and verification all run
in the browser. Documents, messages and plaintext never touch a server. When
content must move between parties it travels over a direct, end to end encrypted
WebRTC channel. On chain, only hashes and account addresses appear, never the
file, the message, or a disclosed name.

**Independent verification.** Anyone can check a signature by reading the public
ledger, with no account and without depending on this site continuing to exist.
The verification endpoint is stateless and never receives the document.

**Unforgeability.** The chain of custody is rooted in soulbound NFTs with locked
rules, so nobody, not even the operator of the site, can fabricate a signature on
someone else's behalf.

**Self custody.** Keys stay in the wallet, the computation stays on the device,
and the only shared dependency is a public, decentralized ledger.

---

## 3. The NFTs

The whole model rests on two base NFTs that a user mints once, plus five NFT
types that live inside their collection.

### 3.1 The two base NFTs (one time only)

**Seal NFT (your insignia).** A soulbound (non transferable, non burnable, non
movable) NFT that anyone self mints once from the official Radix Seal brand
resource. It has two jobs: it identifies you as a signer, and it is the only key
that can ever mint into your personal collection. Because it cannot move,
"collection owned by Seal X, and Seal X located in account S" is a proof, read
from the ledger alone, that the collection belongs to S.

- Resource: the official open mint brand (one per network).
- Local id: a RUID (random, race free for concurrent public mints).
- Withdraw, burn and recall are denied forever, so the seal can never leave the
  account that minted it.

**Signing collection (your on ledger archive).** A personal, reusable non
fungible resource. Its owner rule is locked at creation and requires your Seal
NFT by global id, so only you can ever mint into it. Each document you sign or
request adds a numbered NFT (#1, #2, #3 and so on).

- Metadata marker `radix_sign_collection = v1` lets anyone discover it.
- Metadata `radix_seal` points at the official brand resource it belongs to.
- Optional issuer metadata (`issuer` account, `org_name`, `org_url`, `icon_url`).
- Minting is gated by the owner (the seal); the data of every minted NFT is
  locked; burning is denied so evidence is permanent.

### 3.2 The five NFT types inside the collection

Every one of these shares the same unforgeable chain of custody: it lives in a
collection whose owner is your soulbound Seal, in your account.

| `kind` | Minted by | Proves |
| --- | --- | --- |
| `invite` | The request issuer, one per required signer | Public record of who was asked to sign a document |
| `signature` | Each signer, into their own collection | That this account signed that specific document |
| `cipher-signature` | The encryptor, into their own collection | That this account encrypted a specific file (always minted) |
| `cipher-invite` | The encryptor, one per authorized receiver | That this account may request the file's decryption key |
| `cipher-receipt` | The receiver, after obtaining the key | That this account decrypted the file |

An invitation is a notice, never a signature: signing is always the signer's own
act in their own collection. The issuer can recall a mis sent invitation, but can
never touch a signature. Each NFT records, in locked data, the document hash it
refers to, the account it concerns, and (for a request) the batch geometry so the
full required set is reconstructable from the ledger alone.

---

## 4. Metadata and data conventions (the standard)

An integrator can implement Radix Seal entirely from these conventions.

### 4.1 Brand resource metadata

| Key | Meaning |
| --- | --- |
| `name`, `description`, `icon_url` | Presentation of the brand |
| `info_url` | Link to this documentation |
| `tags` | Includes `radix-seal` |
| `dapp_definitions` | Verified two way link to the dApp definition |

### 4.2 Collection resource metadata

| Key | Meaning |
| --- | --- |
| `radix_sign_collection = v1` | Marks a genuine signing collection |
| `radix_seal` | The official brand resource this collection references |
| `issuer` | The account that created the collection (locked, anti spoofing) |
| `org_name` | Formal issuer name (editable by the owner) |
| `org_url` | Issuer website (editable by the owner) |
| `name`, `icon_url` | Display name and image (editable by the owner) |

### 4.3 NFT data fields (every NFT in a collection)

The data schema is fixed and every field is locked at mint:

| Field | Meaning |
| --- | --- |
| `kind` | `invite`, `signature`, `cipher-signature`, `cipher-invite` or `cipher-receipt` |
| `document_hash` | Blake2b-256 of the document (or of the encrypted container header) |
| `network` | Network id |
| `signer` | The account this NFT concerns |
| `signer_index`, `signer_count`, `first_id` | Batch geometry for a request |
| `request` | The request key this NFT answers |
| `issued_at` | Timestamp |

The **request key** is the first invitation's global id,
`<initiator collection>:#<firstId>#`. From it alone anyone can reconstruct the
immutable required signer set by reading the locked invitation batch.

---

## 5. Signing a document

The document is hashed in the browser with Blake2b-256 and only the hash is ever
signed or anchored. There are three ways to sign.

**Sign alone (off chain).** Your wallet signs a ROLA challenge derived from the
document hash and the canonical metadata (message, disclosure policy, signer set,
nonce, network). The result is a certificate (`.radixsig.json`) carrying the
hash, the signer account, an optional disclosed name or email, and the
cryptographic proof. Optionally you can also anchor a soulbound signature NFT into
your collection.

**Sign with several people (off chain).** You sign first and pass the certificate
and the original file to the others. Each co signer drops both into the tool and
adds their own ROLA signature to the same certificate. When everyone has signed,
anyone can anchor it.

**Sign with several people (on the ledger).** You issue one invitation NFT per
required signer, deposited into their wallets, and share a link. The link is a
clean directory URL that carries the network, the document name and your chosen
output formats. Each invitee opens the link, receives or uploads the document,
the tool checks it matches the request's hash, and they sign from their wallet by
minting their signature NFT. Status updates by reading the ledger; once everyone
has signed, the record is public, permanent and verifiable by anyone.

The optional embedded PDF output carries the certificate and the intact original
document inside it, so a single self contained file verifies on its own.

---

## 6. Encrypting a document

Encryption derives an AES-256-GCM key from a deterministic ROLA signature over a
challenge that commits to a per file salt, so only the account that encrypted a
file can ever re derive the key, from any device, with no key stored anywhere.
The file is processed in chunks in the browser and, when shared, travels directly
browser to browser over an end to end encrypted WebRTC channel. No server sees a
byte.

Two methods:

- **ROLA only.** You decide who to release the key to; there is no on chain
  trace. When a receiver asks, you see who is asking and for which file (a
  human checkable fingerprint), and you approve by signing.
- **ROLA + Ledger.** The encryptor always mints a `cipher-signature` into their
  own collection: a public, permanent record that this account encrypted this
  file (its container header hash), the encryption counterpart of a document
  signature. Authorized receivers are optional: for each one you add, a
  `cipher-invite` NFT is also minted into your collection and deposited into that
  receiver's wallet. A receiver can only request the key by signing a ROLA
  challenge bound to the exact container and session; the encryptor's browser
  verifies, on the ledger, that the account holds the invitation before releasing
  the key. After decrypting, the receiver can optionally mint a `cipher-receipt`
  as public proof that they obtained the key.

The key released over the channel is the derived file key, never the raw ROLA
signature, and the channel itself is DTLS encrypted.

---

## 7. Secure chat

Two parties open an end to end encrypted channel. Both prove their identity by
signing a ROLA challenge with their wallet, and the session key is derived from
that verified exchange, so no server can read, alter or impersonate anything. The
invitation room id rides in the URL fragment, which never reaches server logs.

---

## 8. Verification

Verification is stateless and never sees the document.

**Off chain (ROLA).** The verifier re hashes the file locally, rebuilds the
canonical challenge, and validates each signature against its account's public
key with ROLA. If a single byte of the document changed, the hash no longer
matches and verification fails.

**On the ledger (chain of custody).** A signer counts as signed only when all of
this holds, read from the ledger:

1. A `signature` NFT with the document's hash exists inside a collection.
2. That collection's owner rule, locked forever, requires one specific Seal.
3. That Seal is the official brand resource for the network.
4. That soulbound Seal is located in the signer's account.

For a multi party request the required signer set is re resolved from the
immutable invitation batch, so a certificate cannot understate who had to sign,
and the complete batch must exist so a burned invitation cannot shrink the quorum.

Because none of these checks depends on editable metadata or on this site, a
signature stays verifiable for as long as the public ledger exists.

---

## 9. File formats

**Certificate (`.radixsig.json`).** A JSON envelope with a `payload` (v, doc
hash, hash algorithm, file name and size, message, disclosure policy, email flag,
required signers, timestamp, network id, nonce), an array of `signatures` (each
with the signer account, disclosed name and email if any, and either a ROLA
proof or, for on ledger signatures, `null`), an optional `onChain` anchor and an
optional `request` pointer.

**Encrypted container (`.radixseal.enc`).** A binary container: an 8 byte magic, a
uint32 header length, a canonical JSON header, then AES-256-GCM chunks. The
header records the file salt, base IV, chunk layout, original name and size,
sender account and public key, network, dApp definition, origin, and, for
ROLA + Ledger, the protection mode and the issuer's invite collection. The
per chunk AAD binds the header hash, the chunk index and a last chunk flag, so
reordering, truncation, cross file substitution and header tampering all fail the
authentication tag.

**Signed PDF (optional).** A normal PDF with the certificate and the intact
original document attached inside it, so it verifies on its own.

---

## 10. Sharing and peer to peer transport

Share links use a clean directory format
(`…/console/sign-document/r/<collection>/<id>`) and carry the network, the
document name and the chosen output formats. Session capabilities (a room id, a
key) always ride in the URL fragment, which browsers do not send to servers.

When a file or message must move between parties it travels over a WebRTC
DataChannel, encrypted end to end by DTLS. A signaling room is used only to
exchange the connection handshake, never file data or keys, and it is left as
soon as the channel opens.

---

## 11. The brand resource and its admin badge

The Radix Seal brand is deployed once per network as an open mint, soulbound
resource. Anyone self mints their own Seal from it.

**Official brand-resource addresses.** A signing collection is only genuine if
its `radix_seal` metadata references one of these. Confirm the address before
trusting a collection or a seal:

| Network | Resource address |
| --- | --- |
| Mainnet | `resource_rdx1nf89ryugl2ytuh7lfcrpt7ghudnfah7gdcwwjw6y3e6v5cwrr5tfxs` |
| Stokenet | `resource_tdx_2_1n20d5q2y9p46zrjaw543vcpdmk3dygtlq4uzyw2zvssg48cxsteu3e` |

The brand's cosmetic metadata (name, image, description, info url, tags) can be
made editable by a single admin badge NFT held by the brand steward, so the
artwork or wording can be maintained over time. The admin badge is one NFT
(integer id #1#) whose minting is denied forever, so the authority can never be
duplicated; it is transferable so it can be moved into an access controller. The
brand's owner role requires that NFT (its global id), so only the badge holder
can edit the metadata. Everything security critical stays immutable, and the seal
image is a domain independent URL so a change of the app's own domain never
breaks the on ledger image.

None of the brand metadata is read during verification: it is purely
presentational, so even a compromised admin badge could never forge a signature.

Note on redeploying: the collection's owner rule is bound to a specific Seal at
creation and is immutable. If the brand is redeployed (a new resource address),
existing collections still reference the old Seal, so each account mints a fresh
Seal and creates a fresh collection to sign under the new brand.

---

## 12. Threat model and what cannot be forged

- **Forging a signature for another account.** Impossible. A signature NFT only
  counts when it lives in a collection owned by that account's soulbound Seal.
  Nobody can mint into another account's collection, and seals cannot move.
- **Pointing a certificate at an arbitrary collection.** Rejected. The collection
  must provably belong to the claimed signer through the locked owner rule.
- **Tampering with the document.** Detected. The local re hash no longer matches
  the signed hash.
- **Understating the required signer set.** Rejected. The set is re resolved from
  the immutable invitation batch, and the complete batch must exist.
- **A compromised site operator or admin badge.** Cannot forge signatures: the
  operator never holds user seals, and brand metadata is not part of verification.

What Radix Seal does not defend against is a signer voluntarily disclosing a false
name (see the honest scope below) or losing control of their own account keys.

---

## 13. Honest scope and limits

A Radix Seal signature proves the integrity of a document, its consensus
timestamp, and control of the signing account. Any disclosed name is self
declared by the signer's wallet. It is not an identity verified qualified
electronic signature (such as eIDAS QES), because no authority binds the account
to a verified legal identity. Where regulation requires that, Radix Seal
complements those schemes with stronger custody, confidentiality and longevity;
it does not claim their legal status.

---

## 14. Glossary

- **ROLA**: Radix Off Ledger Authentication. The wallet signs a challenge to
  prove account ownership. Ed25519 signatures are deterministic, so the same
  account over the same challenge always reproduces the same signature (and thus
  the same derived encryption key).
- **Soulbound**: an NFT that cannot be transferred, burned or recalled.
- **Chain of custody**: the locked owner rule linking a collection to a Seal, and
  the Seal to an account, that makes a signature unforgeable.
- **Request key**: the first invitation's global id,
  `<collection>:#<firstId>#`, from which the full required signer set is
  reconstructable.
- **Certificate**: the `.radixsig.json` envelope produced by signing.
- **Container**: the `.radixseal.enc` encrypted file.
