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
   - [3.3 Several collections under one insignia](#33-several-collections-under-one-insignia)
4. [Metadata and data conventions (the standard)](#4-metadata-and-data-conventions-the-standard)
5. [Signing a document](#5-signing-a-document)
   - [5.1 What the signed PDF contains](#51-what-the-signed-pdf-contains)
   - [5.2 Optional certificate signature (PAdES / X.509)](#52-optional-certificate-signature-pades--x509)
6. [Encrypting a document](#6-encrypting-a-document)
7. [Secure chat](#7-secure-chat)
8. [Verification](#8-verification)
   - [8.1 Verification API](#81-verification-api)
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

It powers four self custody tools that all share the same wallet derived trust
model:

- **Collection**: the insignia and the signing collection an account signs from.
  Create them, see which are in use, hold more than one to sign under separate
  identities, and edit the issuer identity that appears on what you issue.
- **Sign document**: prove authorship and integrity of any file, alone or with
  several people, off chain or anchored on the ledger. A signed PDF carries a
  human readable signature page, and can additionally be signed with the
  signer's own X.509 certificate so ordinary PDF readers recognise it.
- **Encrypt document**: lock a file to an account and share it peer to peer,
  optionally gating decryption to on ledger authorized accounts.
- **Secure chat**: end to end encrypted conversations, with encrypted file
  sending of any size, where both sides prove who they are with their wallet.

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
- Its image is written once, at mint: the issuer's logo when one is given, the
  Radix Seal insignia otherwise. The brand declares no mutable NFT field and
  denies the data updater role, so no one, not even the holder, can change it
  afterwards. Radix roles are per resource, not per NFT, so there is no rule
  that would let each holder edit only their own; a uniform, fixed insignia is
  the deliberate consequence.
- One insignia can own **several** collections. A second insignia is only needed
  when a separate identity should carry its own image, and since it can never be
  transferred or burned, minting one is a permanent decision.

**Signing collection (your on ledger archive).** A personal, reusable non
fungible resource. Its owner rule is locked at creation and requires your Seal
NFT by global id, so only you can ever mint into it. Each document you sign or
request adds a numbered NFT (#1, #2, #3 and so on).

- Metadata marker `radix_sign_collection = v1` lets anyone discover it.
- Metadata `radix_seal` points at the official brand resource it belongs to.
- Optional issuer metadata (`issuer` account, `org_name`, `org_url`, `icon_url`).
- Minting is gated by the owner (the seal); the data of every minted NFT is
  locked, image included; burning is denied so evidence is permanent.
- Its owner rule is `Fixed`: the collection is bound to that one insignia for
  life, which is why the pairing can be read from the ledger and trusted.

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

### 3.3 Several collections under one insignia

An account may hold more than one signing collection, and that is a supported
shape rather than an accident. The issuer identity (`name`, `icon_url`,
`org_name`, `org_url`) lives on the collection, so one account can sign as an
individual from one collection and as a company from another, or keep one
collection per company.

What this implies, and the tooling reflects it:

- **Evidence never moves.** Invitations and signatures stay in the collection
  they were minted into. Switching which collection is active only decides where
  the *next* ones go, and anyone holding an older invitation keeps seeing the
  issuer identity of the collection it came from.
- **The active collection is chosen deterministically**, by minted supply, so a
  freshly created empty one can never displace the collection that holds an
  account's history.
- **The insignia is resolved from the collection**, not from the wallet: a
  collection's owner rule names one specific seal, and that is the only one whose
  proof its mints accept. An account holding two insignias therefore still signs
  correctly.
- **A brand new collection holds no NFT of its own**, so it is invisible to a
  scan of what an account holds until its first mint. Discovery accounts for
  this; a third party integrator scanning holdings should expect the same blind
  spot.
- **The EARLIEST signature answers "when".** An account can hold several
  signature NFTs for the same document — across collections, or from signing the
  same file again — and the order a Gateway returns collections in is not an
  order anybody promised. As a yes/no answer that made no difference; as a date
  it does, so the first moment the account committed to that hash is the answer,
  and it is the same answer for every caller. An integrator resolving a date
  should take the minimum state version, not the first hit.
- **Only collections under the CURRENT brand count.** After a brand redeploy,
  collections created for the previous seal still exist and still hold their
  evidence, but they no longer satisfy the insignia check, so their signatures
  do not count towards a request. Both public endpoints apply this identically.

Issuer identity is editable after creation by the seal holder (`SET_METADATA`
under the owner role), so a name, a logo or an organisation's website can be
corrected without touching anything that a signature proves: the marker, the
brand reference, the issuing account and every NFT's own data were locked at
creation and can never be rewritten.

In the app this is the **Collection** tool: it lists the insignias an account
holds and the collection each one commands, lists the collections with how many
records they hold, switches which is active, creates new ones (reusing the
existing insignia by default, or minting a fresh one for a separate identity)
and edits the issuer identity. None of it is required to start: signing or
encrypting for the first time still provisions a seal and a collection in one
step.

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

A collection may also carry free form keys of its owner's choosing, written at
creation and optionally locked forever, for whatever the standard's own keys have
no place for: a department, a registry number, an internal reference. The keys
above are reserved, so a custom entry can never redefine one, and none of them is
read during verification.

### 4.3 NFT data fields (every NFT in a collection)

The data schema is fixed and every field is locked at mint, `key_image_url`
included. Invitations land in other people's wallets, so a fixed image both
carries the Radix Seal mark wherever evidence travels and stops an issuer from
restyling a record after it was signed. A schema is set at creation and can
never be altered, so a collection's mutable field set is whatever it declared on
day one: an integrator reads it from the resource
(`non_fungible_data_mutable_fields`) rather than assuming.

| Field | Meaning |
| --- | --- |
| `kind` | `invite`, `signature`, `cipher-signature`, `cipher-invite` or `cipher-receipt` |
| `document_hash` | Blake2b-256 of the document (or of the encrypted container header) |
| `network` | Network id |
| `signer` | The account this NFT concerns |
| `signer_index`, `signer_count`, `first_id` | Batch geometry for a request |
| `request` | The request key this NFT answers |
| `issued_at` | Ledger time read just before the mint (see below on dates) |

The **request key** is the first invitation's global id,
`<initiator collection>:#<firstId>#`. From it alone anyone can reconstruct the
immutable required signer set by reading the locked invitation batch.

**On dates.** A mint cannot carry the consensus time of its own transaction:
that time does not exist until the transaction commits, and a manifest has no way
to pipe the result of `get_current_time` into the data of a `MINT` instruction.
So `issued_at` is always written before the fact and is a claim, never evidence.

Two things follow, and this implementation does both. The claim is sourced from
the network rather than from the signer's browser — the Gateway's current
`proposer_round_timestamp`, read immediately before building the manifest, so it
lands seconds ahead of the commit instead of wherever a local clock was set. And
the claim is checked: verification resolves the commit time from the state
version the NFT was last updated at, compares `issued_at` against it, and reports
any record that contradicts the ledger it lives on (`issuedAtAnchored`).

The authoritative date of an on ledger signature therefore remains the commit
time, not `issued_at`. An integrator reading the ledger directly should resolve
it the same way, and treat a divergence as a record worth distrusting.

One caveat on comparing them: only an unambiguous instant can be compared.
Collections minted before the format settled carry a locale formatted date with
no timezone (`07/19/2026 17:17:25`), and an NFT minted by hand through the
console carries whatever its owner typed. Resolving those against the reader's
own timezone would make the same record pass in UTC and fail two hours out
elsewhere, so `issuedAtAnchored` reports them as `null` (unknown) rather than as
a contradiction. Silence is the honest answer where the ledger cannot adjudicate.

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

Once the wallet returns the proof, a Time Stamping Authority is asked to attest
that it exists, and its token travels in the certificate (see section 9). An off
ledger signature otherwise has no clock but the signer's own browser, which is
another way of saying it has none: the date could be rewritten to any day at all
and nothing would contradict it. The authority's time then becomes the recorded
date. It is best effort — if the authority is unreachable the signature is made
anyway with the local clock, and verification says plainly that the date rests on
nothing.

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

### 5.1 What the signed PDF contains

A delivered PDF is assembled in a fixed order, and only the first and last steps
touch the bytes a reader sees:

1. **Watermark** (optional). A presentation layer stamped on the carrier: the
   Radix Seal mark, or your own text or image. Its specification travels inside
   the PDF as an attachment, so a co signer rebuilding the document reproduces
   the same look instead of losing it.
2. **Visible signature page.** A rendered page appended at the end, readable in
   any viewer without opening an attachments panel. It states the issuer, the
   file, the document hash, the network, the dates, every signer (with the name
   marked as self declared), who is still pending, the on ledger record, a QR
   code to the verifier, and an honest note on what the signature proves.
3. **Attachments.** The certificate, the intact original document and the
   watermark specification.
4. **Certificate signature** (optional, see 5.2). Applied last, because any
   later change to the bytes would invalidate it.

Because the original document is embedded intact and is what verification re
hashes, none of the presentation layers can affect the document hash.

### 5.2 Optional certificate signature (PAdES / X.509)

A PDF can additionally be signed with the signer's own X.509 certificate,
producing a standard PAdES / PKCS#7 signature. This is what makes a PDF reader
such as Adobe or Foxit show the document in its native signature panel and
validate the certificate's distinguished name against its own trusted
authorities.

The certificate is supplied by the signer as a PKCS#12 bundle and the signature
is computed in the browser: the private key never leaves the device and is never
uploaded. There is no endpoint that signs on someone's behalf, because that
would mean holding their key.

The two layers are independent and complementary. Radix Seal proves integrity,
timestamp and control of an account without any authority; the X.509 layer adds
the legal recognition that a trusted certificate authority provides. A self
signed certificate still produces a valid PAdES signature, but a reader will
mark it untrusted until the recipient trusts it.

Co signing rebuilds the PDF from the intact original, so the previous signer's
PAdES signature does not survive that step. Each signer's certificate identity
is therefore recorded in the certificate itself (see 9), which keeps it on the
record for every later signature. That record is informational: unlike the ROLA
proof, it is not cryptographically bound, and only the PDF's current signature
is validated by the reader.

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

The transfer itself is **resumable**. Chunks are written to the receiver's
IndexedDB one by one, and when a channel is lost the session rejoins the same
room and tells the sender how many it already holds, so the file continues from
there instead of starting over. Progress reports only bytes that actually left
the send buffer, so the two sides cannot disagree about how far along they are.

---

## 7. Secure chat

Two parties open an end to end encrypted channel. Both prove their identity by
signing a ROLA challenge with their wallet, and the session key is derived from
that verified exchange, so no server can read, alter or impersonate anything. The
invitation room id rides in the URL fragment, which never reaches server logs.

Each side also sends the wallet persona label it chose for itself, so the room
shows a name above the account address. That name is convenience only: it is not
part of the signed challenge, so a name saved locally in the address book always
takes precedence and the verified identity is the account, never the label. A
live typing indicator travels on the same channel and carries no content.

Files can be sent over the same channel with no size limit: they are encrypted
with the session key and streamed in chunks, so memory stays flat on both sides
(the only bound is the receiving browser's storage quota). Messages exist only
on the open page; the local copy a browser keeps of received files, used for
the download, is deleted automatically after 24 hours. Anything the user saved
to disk is, of course, theirs to keep.

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

### 8.1 Verification API

Two public POST endpoints let a system verify without a browser, a wallet, an
account or an API key. Both are stateless and neither ever receives a document.

**`/api/sign/verify`** takes the certificate wrapped in an `envelope` field (the
whole contents of the `.radixsig.json`) and answers with:

| Field | Meaning |
| --- | --- |
| `complete` | Every required signer has a valid signature. This is the field to gate on |
| `allValid` | Every signature present is cryptographically valid |
| `signatures` | Per signer: account, disclosed name and email, `valid`, `required`, plus the time fields below |
| `requiredSigners` | The authoritative required set |
| `requestSource` | Where that set came from: `typed`, `certificate` or `none` |
| `requestMismatch` | The certificate points at a request other than the one you supplied |
| `payloadBound` | A valid ROLA proof covers the payload, so message, file name and date are signed |
| `docHash`, `timestamp`, `message`, `networkId` | Payload data |
| `onChainValid`, `sealValid` | On ledger anchor and official insignia |

Per signature, the time fields answer "according to what, other than this
certificate?":

| Field | Meaning |
| --- | --- |
| `anchoredAt` | The independent time, or `null` when the signature offers none |
| `anchorSource` | `ledger` (consensus time of the minting transaction) or `timestamp` (an RFC 3161 authority) |
| `signedAtAnchored` | Whether the declared `signedAt` agrees with it, within ten minutes |
| `issuedAtAnchored` | Whether the NFT's own `issued_at` agrees with its transaction's commit time |
| `timestampAuthority` | Name of the timestamping authority, for display |
| `timestampUntrustedAnchor` | The token verifies but its trust anchor is not one this deployment knows |

**Pass a request key when you have one.** A certificate names the on ledger
request it wants to be measured against, and anyone can mint a collection whose
one name invitation batch its own signature satisfies. Send the key you obtained
independently as `requestOverride` (`{"networkId":2,"requestId":"resource_...:#25#"}`)
and it replaces the certificate's, with `requestMismatch` telling you if the
certificate was pointing elsewhere.

**What a signature does and does not cover.** Only the `payload` is bound by the
ROLA challenge. The disclosed name and email sit outside it in both modes and are
never on the ledger, so they are declarations, never evidence. When
`payloadBound` is false — a purely on ledger certificate — the ledger ties the
signer to the document hash and to nothing else, and the message, file name and
document date are declarations too.

`onChainValid` and `sealValid` are `null` when they do not apply (an off ledger
certificate, or the brand not deployed on that network). Null means "nothing to
check", not "invalid": treating it as a failure would reject valid certificates.

```bash
jq '{envelope: .}' document.radixsig.json \
  | curl -X POST https://radix-community.genkipool.com/api/sign/verify \
      -H 'Content-Type: application/json' --data-binary @-
```

**`/api/sign/onchain-status`** takes `networkId` plus a `requestId` (and
optionally a `docHash`) and reports, straight from the ledger, who was required
to sign, who has signed and when (`signedAt`, the consensus time of the earliest
qualifying minting transaction), whether it is `complete`, whether the hash
matches, and the issuer's published identity. It applies exactly the same chain
of custody as `/api/sign/verify`, official insignia included, so the two never
disagree about who has signed or when. It needs neither the document nor the
certificate, so it suits polling the state of a file being signed.

```bash
curl -X POST https://radix-community.genkipool.com/api/sign/onchain-status \
  -H 'Content-Type: application/json' \
  -d '{"networkId":2,"requestId":"resource_tdx_2_1...:#25#"}'
```

**Checking the document is the caller's job.** The API never sees the file, so a
positive answer only proves that someone signed *a* hash. To prove it is *your*
document, hash it locally with Blake2b-256 and compare it against `docHash`.
Accept only when the hashes match AND `complete` is true. With a signed PDF, the
bytes to hash are the embedded `radix-original-<name>` attachment, not the PDF
itself, which additionally carries the presentation layers.

**Limits and errors.** 300 requests per minute per IP (`429` with `Retry-After`),
certificates up to 256 KiB (`413`), `400` for malformed JSON, a certificate that
fails the schema or an unknown network, and `500` on internal failure.

**Deployment note.** ROLA validates the origin the signature was produced for,
taken from the deployment's configured application URL. Verify against the same
deployment that produced the signatures; an institution running its own instance
on another domain will not validate off ledger signatures made elsewhere by this
route. On ledger signatures are unaffected: they are checked through the chain of
custody by reading the network, independently of any domain. One more reason to
anchor anything that matters.

---

## 9. File formats

**Certificate (`.radixsig.json`).** A JSON envelope with a `payload` (v, doc
hash, hash algorithm, file name and size, message, disclosure policy, email flag,
required signers, timestamp, network id, nonce), an array of `signatures` (each
with the signer account, disclosed name and email if any, and either a ROLA
proof or, for on ledger signatures, `null`), an optional `onChain` anchor and an
optional `request` pointer.

A signature made off ledger may also carry `timeStampToken`: an RFC 3161 token
(base64 DER) in which a Time Stamping Authority attests that this signature
already existed at a given moment. Its message imprint is the SHA-256 of
`radix-seal-timestamp:v1|<signer account>|<challenge>|<signature hex>`, so a
token cannot be lifted from one signature onto another, and verification
recomputes it from data already in the certificate. Requesting one is best effort
— an authority being unreachable never blocks a signature — so the field is
absent on certificates signed while it was down, and on every certificate
produced before the field existed.

A signature entry may also carry an optional `certificate` object recording the
X.509 identity that signer used for the PDF's PAdES signature: `subjectCN`,
`subjectO`, `issuer`, `serialNumber`, `validFrom` and `validTo`. It exists so the
identity survives co signing, is purely informational, and is never part of
verification. Only the `payload` is bound by the ROLA challenge, so adding this
field does not affect any signature.

**Signed PDF.** A normal PDF that carries, as embedded files,
`radix-certificate.radixsig.json` (the certificate), `radix-original-<name>`
(the intact original document, which is what verification re hashes) and, when
one was applied, `radix-watermark.json` (the watermark specification, so co
signers reproduce the same look). It also has the visible signature page
appended, and optionally a PAdES signature over the whole file.

**Encrypted container (`.radixseal.enc`).** A binary container: an 8 byte magic, a
uint32 header length, a canonical JSON header, then AES-256-GCM chunks. The
header records the file salt, base IV, chunk layout, original name and size,
sender account and public key, network, dApp definition, origin, and, for
ROLA + Ledger, the protection mode and the issuer's invite collection. The
per chunk AAD binds the header hash, the chunk index and a last chunk flag, so
reordering, truncation, cross file substitution and header tampering all fail the
authentication tag.


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

Whether the peer is still there is decided by **evidence, not by ICE state**.
ICE reports `disconnected` on paths that are working perfectly — a busy relay, a
lossy uplink, a Wi-Fi hand-off — so that alone never ends a session. Two facts
count as proof of life: a frame arrived, or bytes left the send buffer (SCTP
only releases them once the peer acknowledges them). A transport keepalive every
few seconds supplies that proof while the application is idle, and its packets
also keep ICE's own receiving flag set on both sides. Sending is paced: the send
buffer is capped and the event loop is handed back periodically, so a long
transfer cannot starve the timers and handlers that keep the session healthy.

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
- **Understating the required signer set.** Rejected *when you supply the request
  key*. The set is re resolved from the immutable invitation batch and the
  complete batch must exist, but the certificate nominates which request that is.
  Anyone can mint a collection and a one name invitation batch their own
  signature satisfies, so a certificate checked against its own pointer is
  checked against a yardstick its author chose. Pass the key you obtained
  independently (`requestOverride`, or the field in the verification tab) and it
  wins; `requestMismatch` then reports a certificate that was pointing elsewhere.
- **Backdating a signature.** Detected when the signature carries an independent
  clock. On ledger, the consensus time of the minting transaction is not
  something the signer picks. Off ledger, an RFC 3161 token proves the signature
  already existed at the authority's time, and a certificate claiming an earlier
  date contradicts it (`signedAtAnchored: false`). A signature with neither is
  reported as having no independent clock rather than shown with a green tick
  beside a date resting on nothing.
- **A compromised site operator or admin badge.** Cannot forge signatures: the
  operator never holds user seals, and brand metadata is not part of verification.

**Minting a signature NFT by hand is not an attack.** The console lets an account
mint into its own collection with the whole schema filled in, and that produces a
genuine signature: the mint is authorised by the account's own seal, so whatever
it records, that account signed it. The security model never rested on this app
being the only way to reach the ledger.

What Radix Seal does not defend against is a signer voluntarily disclosing a false
name (see the honest scope below), the message and file name of a purely on ledger
certificate (the ledger binds the signer and the document hash and nothing else,
which is why `payloadBound` is reported), or losing control of their own account
keys.

---

## 13. Honest scope and limits

A Radix Seal signature proves the integrity of a document, its consensus
timestamp, and control of the signing account. Any disclosed name is self
declared by the signer's wallet. It is not an identity verified qualified
electronic signature (such as eIDAS QES), because no authority binds the account
to a verified legal identity. Where regulation requires that, Radix Seal
complements those schemes with stronger custody, confidentiality and longevity;
it does not claim their legal status.

The optional certificate signature (5.2) is how the two meet: bring your own
X.509 certificate from a trusted authority and the same PDF carries both the
legal recognition that authority provides and the self custodied, permanently
verifiable Radix record. Radix Seal never issues certificates, and the visible
signature page states plainly what each layer does and does not prove, so a
document is never dressed up as qualified when it is not.

On longevity, the two modes differ. An on ledger signature stays verifiable for
as long as the Radix Network exists, whatever happens to the accounts afterwards.
The lighter off ledger certificate also never expires and verifies against the
ledger without depending on this site, with one caveat: it relies on the signer
not later rotating the key set of their account. For anything meant to hold up
over the long term, anchor it.

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

