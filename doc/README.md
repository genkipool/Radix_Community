# Radix Seal

Radix Seal is an open, self custody standard for signing, encrypting and
exchanging documents on the Radix Network. It turns the Radix Wallet into your
own certificate authority: you issue, and the public ledger attests. There is
no company in the middle that stores your files or that anyone has to trust for
a signature to remain verifiable.

This document explains, in full detail, what Radix Seal is, what it does, how it
does it, and how it works.

---

## 1. What Radix Seal is

Radix Seal is defined by a small set of public metadata conventions and NFT
data shapes on the Radix ledger. Any wallet, explorer or third party tool can
implement it without permission: discover a signer's collection, check its
insignia and verify its signatures. There is no proprietary format and no
central server in the trust path.

It powers three self custody tools that all share the same wallet derived trust
model:

- **Sign document**: prove authorship and integrity of any file.
- **Encrypt document**: lock a file to an account, share it peer to peer.
- **Chat**: end to end encrypted conversations where both sides prove who they
  are with their wallet.

The core promises:

- **Privacy by design.** Files are hashed, encrypted and decrypted entirely in
  your browser. The document itself never touches a server. Only what is needed
  to verify (a hash and account addresses) is ever anchored on chain.
- **Independent verification.** Anyone can check a signature by reading the
  public ledger, with no account and without depending on this site continuing
  to exist.
- **Unforgeability.** The chain of custody is rooted in soulbound NFTs with
  locked rules, so nobody, not even the operator of the site, can fabricate a
  signature on someone else's behalf.

---

## 2. The NFTs

The whole model rests on two base NFTs that a user mints once, plus four NFT
types that live inside their collection.

### The two base NFTs (one time only)

**Seal NFT (your insignia).** A soulbound (non transferable, non burnable,
non movable) NFT that anyone self mints once from the official Radix Seal brand
resource. It has two jobs: it identifies you as a signer, and it is the only key
that can ever mint into your personal collection. Because it cannot move,
"collection owned by Seal X, and Seal X located in account S" is a proof, read
from the ledger alone, that the collection belongs to S.

**Signing collection (your on ledger archive).** A personal, reusable NFT
resource. Its owner rule is locked at creation and requires your Seal, so only
you can ever mint into it. Everything inside is soulbound and its data is locked
forever. Each document you sign adds a numbered NFT (#1, #2, #3 and so on).

### The four NFT types inside the collection

Every one of these shares the same unforgeable chain of custody: it lives in a
collection whose owner is your soulbound Seal, in your account.

| Kind | Minted by | Proves |
| --- | --- | --- |
| `invite` (signature invitation) | The request issuer, one per required signer | Public record of who was asked to sign a document |
| `signature` | Each signer, into their own collection | That this account signed that specific document |
| `cipher-invite` (encryption invitation) | The encryptor, one per authorized receiver | That this account may request the file's decryption key |
| `cipher-receipt` (decryption receipt) | The receiver, after obtaining the key | That this account decrypted the file |

An invitation is a notice, never a signature: signing is always the signer's own
act in their own collection. The issuer can recall a mis sent invitation, but can
never touch a signature. Each NFT records, in locked data, the document hash it
refers to, the signer or receiver account, and (for a request) the batch geometry
so the full required set is reconstructable from the ledger.

---

## 3. Signing a document

There are three ways to sign.

**Sign alone (off chain).** Your wallet signs a ROLA challenge derived from the
document hash and the canonical metadata. The result is a certificate
(`.radixsig.json`) that carries the hash, the signer account, an optional
disclosed name or email, and the cryptographic proof. Optionally you can also
anchor a soulbound signature NFT into your collection.

**Sign with several people (off chain).** You sign first and pass the
certificate and the original file to the others. Each co signer drops both into
the tool and adds their ROLA signature. When everyone has signed, anyone can
anchor it.

**Sign with several people (on the ledger).** You issue one invitation NFT per
required signer, deposited into their wallets. You share a link that carries the
right network, the document name and your chosen output formats. Each invitee
opens the link, receives or uploads the document, the tool checks it matches the
request's hash, and they sign from their wallet by minting their signature NFT.
The status updates by reading the ledger; once everyone has signed, the record is
public, permanent and verifiable by anyone.

The signed PDF (optional embedded output) carries the certificate and the intact
original document inside it, so a single self contained file verifies on its own.

---

## 4. Encrypting a document

Encryption derives an AES 256 GCM key from a deterministic ROLA signature, so
only the account that encrypted a file can ever unlock it, from any device, with
no key stored anywhere. The file is processed in chunks in the browser and, when
shared, travels directly browser to browser over an end to end encrypted WebRTC
channel. No server sees a byte.

There are two methods:

- **ROLA only.** You decide who to release the key to. There is no on chain
  trace.
- **ROLA + Ledger.** You authorize specific accounts in advance by minting one
  `cipher-invite` NFT per receiver. A receiver can only request the key by
  signing a ROLA challenge with an invited account; the encryptor's browser
  verifies, on the ledger, that the account holds the invitation before releasing
  the key. After decrypting, the receiver can optionally mint a `cipher-receipt`
  as public proof that they obtained the key.

---

## 5. How verification works

Verification is stateless and never sees the document.

**Off chain (ROLA).** The verifier re hashes the file locally, rebuilds the
canonical challenge, and validates each signature against its account's public
key. If a single byte of the document changed, the hash no longer matches and
verification fails.

**On the ledger (chain of custody).** A signer counts as signed only when all of
this holds, read from the ledger: a `signature` NFT with the document's hash
exists inside a collection whose owner rule, locked forever, requires one
specific Seal, and that soulbound Seal is located in the signer's account. For a
multi party request the required signer set is re resolved from the immutable
invitation batch, so a certificate cannot understate who had to sign, and the
complete batch must exist so a burned invitation cannot shrink the quorum.

Because none of these checks depends on editable metadata or on this site, a
signature stays verifiable for as long as the public ledger exists.

---

## 6. The brand resource and its admin badge

The Radix Seal brand is deployed once per network as an open mint, soulbound
resource. Anyone self mints their own Seal from it. The brand's cosmetic
metadata (name, image, description) can be made editable by a single admin badge
held by the brand steward, so the artwork or wording can be maintained over time,
while the security critical properties stay immutable. The seal image is a
domain independent URL, so a change of the app's own domain never breaks the on
ledger image.

None of the brand metadata is read during verification: it is purely
presentational, so even a compromised admin badge could never forge a signature.

---

## 7. Honest scope

A Radix Seal signature proves the integrity of a document, its consensus
timestamp, and control of the signing account. Any disclosed name is self
declared by the signer's wallet. It is not an identity verified qualified
electronic signature (such as eIDAS QES), because no authority binds the account
to a verified legal identity. Where regulation requires that, Radix Seal
complements those schemes with stronger custody, confidentiality and longevity;
it does not claim their legal status.
