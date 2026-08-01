/**
 * Cryptographic verification of an RFC 3161 timestamp token. Server-side.
 *
 * A token is only evidence if every link is checked, so this does all of them:
 *
 *   the imprint inside the token is THIS signature's
 *     → the signed attributes really digest the TSTInfo they claim to
 *       → the CMS signature over those attributes verifies with a certificate
 *         carrying the time-stamping EKU, valid at the asserted time
 *         → that certificate chains, signature by signature, to an anchor
 *           whose fingerprint is reported (and matched against the allowlist).
 *
 * The token is navigated with an exact byte reader rather than by re-encoding
 * parsed structures: the CMS signature covers specific bytes, and re-encoding
 * them is how verifiers end up hashing something subtly different.
 *
 * Signature checking goes through node:crypto, not a userland library. Real
 * authorities sign with whatever they please — the default one here uses ECDSA
 * P-384 under an RSA root — and only the platform covers every case correctly.
 */
import 'server-only';
import { X509Certificate, createHash, verify as cryptoVerify } from 'node:crypto';
import { childNodes, readNode } from './tsa';
import type { TimestampCheck } from './timestamp';

/* ─── Trust anchors ───────────────────────────────────────────────────────── */

/**
 * SHA-256 of the topmost certificate each known authority's tokens chain to.
 * A token from any other anchor still verifies cryptographically; it is simply
 * reported as untrusted, because "signed by someone" is not "signed by someone
 * this deployment recognises". Extend with `SIGN_TSA_ANCHORS` (comma-separated).
 */
const BUILTIN_ANCHORS = [
  // Free TSA root CA (freetsa.org), the default authority.
  'a6379e7cecc05faa3cbf076013d745e327bbbaa38c0b9af22469d4701d18aabc',
  // DigiCert Trusted Root G4, the anchor of DigiCert's timestamping chain.
  '33846b545a49c9be4903c60e01713c1bd4e4ef31ea65cd95d69e62794f30b941',
];

function trustedAnchors(): Set<string> {
  const extra = (process.env.SIGN_TSA_ANCHORS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase().replace(/:/g, ''))
    .filter(Boolean);
  return new Set([...BUILTIN_ANCHORS, ...extra]);
}

/** RFC 3280 id-kp-timeStamping: the only EKU allowed to sign a token. */
const EKU_TIME_STAMPING = '1.3.6.1.5.5.7.3.8';

/* ─── DER constants and helpers ───────────────────────────────────────────── */

const SEQUENCE = 0x30;
const SET = 0x31;
const OCTET_STRING = 0x04;
const OID_TAG = 0x06;
const GENERALIZED_TIME = 0x18;
const CONTEXT_0 = 0xa0;

const OID_SIGNED_DATA = '2a864886f70d010702';
const OID_TST_INFO = '2a864886f70d0109100104';
const OID_MESSAGE_DIGEST = '2a864886f70d010904';

/** Digest to use, keyed by either a digest OID or a `<digest>With<key>` OID. */
const DIGEST_BY_OID: Record<string, string> = {
  '608648016503040201': 'sha256',
  '608648016503040202': 'sha384',
  '608648016503040203': 'sha512',
  '2b0e03021a': 'sha1',
  // RSA
  '2a864886f70d010105': 'sha1',
  '2a864886f70d01010b': 'sha256',
  '2a864886f70d01010c': 'sha384',
  '2a864886f70d01010d': 'sha512',
  // ECDSA
  '2a8648ce3d0401': 'sha1',
  '2a8648ce3d040302': 'sha256',
  '2a8648ce3d040303': 'sha384',
  '2a8648ce3d040304': 'sha512',
};

interface Node {
  tag: number;
  start: number;
  contentStart: number;
  end: number;
}

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

/** Body bytes of an OID node, as hex — enough to compare against a constant. */
const oidHex = (bytes: Uint8Array, node: Node): string =>
  hex(bytes.slice(node.contentStart, node.end));

const sha = (algorithm: string, data: Uint8Array): string =>
  createHash(algorithm).update(data).digest('hex');

/** First child with the given tag. */
function findChild(bytes: Uint8Array, node: Node, tag: number): Node | null {
  return childNodes(bytes, node).find((child) => child.tag === tag) ?? null;
}

/**
 * ASN.1 GeneralizedTime → Date. Always UTC in a token (RFC 3161 requires the
 * `Z` form), and the fractional part is optional.
 */
function generalizedTimeToDate(text: string): Date | null {
  const match = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction] = match;
  const millis = fraction ? Math.round(Number(fraction) * 1000) : 0;
  const when = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    millis,
  );
  return Number.isNaN(when) ? null : new Date(when);
}

/* ─── TSTInfo ─────────────────────────────────────────────────────────────── */

/**
 * TSTInfo fields are positional up to genTime (version, policy, messageImprint,
 * serialNumber, genTime), so no tag hunting is needed for the parts we check.
 */
function parseTstInfo(
  bytes: Uint8Array,
): { imprintHex: string; genTime: Date } | null {
  const top = readNode(bytes, 0);
  if (!top || top.tag !== SEQUENCE) return null;
  const parts = childNodes(bytes, top);
  const imprint = parts[2];
  const genTime = parts[4];
  if (!imprint || imprint.tag !== SEQUENCE) return null;
  if (!genTime || genTime.tag !== GENERALIZED_TIME) return null;
  const hash = findChild(bytes, imprint, OCTET_STRING);
  if (!hash) return null;
  const when = generalizedTimeToDate(
    Buffer.from(bytes.slice(genTime.contentStart, genTime.end)).toString('ascii'),
  );
  if (!when) return null;
  return { imprintHex: hex(bytes.slice(hash.contentStart, hash.end)), genTime: when };
}

/* ─── Certificates ────────────────────────────────────────────────────────── */

function parseCertificates(bytes: Uint8Array, block: Node): X509Certificate[] {
  const out: X509Certificate[] = [];
  for (const node of childNodes(bytes, block)) {
    if (node.tag !== SEQUENCE) continue;
    try {
      out.push(new X509Certificate(Buffer.from(bytes.slice(node.start, node.end))));
    } catch {
      // A certificate we cannot parse simply cannot be the signer.
    }
  }
  return out;
}

const fingerprintOf = (cert: X509Certificate): string =>
  cert.fingerprint256.replace(/:/g, '').toLowerCase();

/** Whether a certificate is allowed to sign timestamps at all. */
const allowsTimeStamping = (cert: X509Certificate): boolean =>
  (cert.keyUsage ?? []).includes(EKU_TIME_STAMPING);

/**
 * Walks issuer by issuer through the certificates the token carries, verifying
 * each signature, and returns the last certificate reached. A broken link makes
 * the whole token unusable rather than silently shortening the chain.
 */
function resolveAnchor(
  signer: X509Certificate,
  pool: X509Certificate[],
): { anchor: X509Certificate; ok: boolean } {
  let current = signer;
  const seen = new Set([fingerprintOf(current)]);
  for (;;) {
    const issuer = pool.find((candidate) => {
      if (seen.has(fingerprintOf(candidate))) return false;
      try {
        return current.checkIssued(candidate);
      } catch {
        return false;
      }
    });
    if (!issuer) break;
    try {
      if (!current.verify(issuer.publicKey)) return { anchor: current, ok: false };
    } catch {
      return { anchor: current, ok: false };
    }
    seen.add(fingerprintOf(issuer));
    current = issuer;
  }
  return { anchor: current, ok: true };
}

/** The CN of a certificate's subject, for display. */
function commonName(cert: X509Certificate): string | null {
  const line = cert.subject
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('CN='));
  return line ? line.slice(3) : null;
}

/* ─── The check ───────────────────────────────────────────────────────────── */

function fail(reason: string): TimestampCheck {
  return {
    valid: false,
    genTime: null,
    authority: null,
    anchorFingerprint: null,
    trusted: false,
    reason,
  };
}

/**
 * Verifies `tokenDer` and confirms it timestamps exactly `expectedImprintHex`
 * (the SHA-256 that `timestampImprintInput` defines for this signature).
 */
export function verifyTimeStampToken(
  tokenDer: Uint8Array,
  expectedImprintHex: string,
): TimestampCheck {
  const contentInfo = readNode(tokenDer, 0);
  if (!contentInfo || contentInfo.tag !== SEQUENCE) return fail('malformed');
  const ciParts = childNodes(tokenDer, contentInfo);
  if (!ciParts[0] || oidHex(tokenDer, ciParts[0]) !== OID_SIGNED_DATA) {
    return fail('not_signed_data');
  }
  const explicit = ciParts[1];
  if (!explicit || explicit.tag !== CONTEXT_0) return fail('malformed');
  const signedData = childNodes(tokenDer, explicit)[0];
  if (!signedData || signedData.tag !== SEQUENCE) return fail('malformed');

  // version, digestAlgorithms, encapContentInfo, [0] certs?, [1] crls?, signerInfos
  const sdParts = childNodes(tokenDer, signedData);
  const encap = sdParts[2];
  const certBlock = sdParts.find((node) => node.tag === CONTEXT_0);
  const signerInfos = [...sdParts].reverse().find((node) => node.tag === SET);
  if (!encap || encap.tag !== SEQUENCE || !certBlock || !signerInfos) {
    return fail('malformed');
  }

  // eContent: [0] EXPLICIT OCTET STRING wrapping the TSTInfo DER.
  const encapParts = childNodes(tokenDer, encap);
  if (!encapParts[0] || oidHex(tokenDer, encapParts[0]) !== OID_TST_INFO) {
    return fail('not_tst_info');
  }
  const eContentWrapper = encapParts[1];
  if (!eContentWrapper) return fail('malformed');
  const eContent = findChild(tokenDer, eContentWrapper, OCTET_STRING);
  if (!eContent) return fail('malformed');
  const tstBytes = tokenDer.slice(eContent.contentStart, eContent.end);

  const tst = parseTstInfo(tstBytes);
  if (!tst) return fail('malformed_tst_info');
  // The token must be about THIS signature; a token lifted from elsewhere fails
  // here regardless of how well it verifies on its own.
  if (tst.imprintHex.toLowerCase() !== expectedImprintHex.toLowerCase()) {
    return fail('imprint_mismatch');
  }

  const signerInfo = childNodes(tokenDer, signerInfos)[0];
  if (!signerInfo || signerInfo.tag !== SEQUENCE) return fail('malformed');
  // version, sid, digestAlgorithm, [0] signedAttrs, signatureAlgorithm, signature
  const siParts = childNodes(tokenDer, signerInfo);
  const digestAlg = siParts[2];
  const signedAttrs = siParts[3];
  if (!digestAlg || !signedAttrs || signedAttrs.tag !== CONTEXT_0) {
    // RFC 3161 tokens always carry signed attributes; without them there is
    // nothing binding the signature to the TSTInfo we just read.
    return fail('no_signed_attributes');
  }
  const signatureAlg = siParts[4];
  const signatureNode = siParts[5];
  if (!signatureAlg || !signatureNode || signatureNode.tag !== OCTET_STRING) {
    return fail('malformed');
  }

  const digestOid = findChild(tokenDer, digestAlg, OID_TAG);
  const signatureOid = findChild(tokenDer, signatureAlg, OID_TAG);
  if (!digestOid || !signatureOid) return fail('malformed');
  const digestName = DIGEST_BY_OID[oidHex(tokenDer, digestOid)];
  const signatureDigest = DIGEST_BY_OID[oidHex(tokenDer, signatureOid)] ?? digestName;
  if (!digestName || !signatureDigest) return fail('unsupported_algorithm');

  // The messageDigest attribute must be the digest of the TSTInfo bytes.
  const expectedDigest = sha(digestName, tstBytes);
  let messageDigestOk = false;
  for (const attr of childNodes(tokenDer, signedAttrs)) {
    const attrParts = childNodes(tokenDer, attr);
    if (!attrParts[0] || oidHex(tokenDer, attrParts[0]) !== OID_MESSAGE_DIGEST) {
      continue;
    }
    const valueSet = attrParts[1];
    const value = valueSet && findChild(tokenDer, valueSet, OCTET_STRING);
    if (!value) break;
    messageDigestOk =
      hex(tokenDer.slice(value.contentStart, value.end)) === expectedDigest;
    break;
  }
  if (!messageDigestOk) return fail('message_digest_mismatch');

  /*
   * What the signature actually covers: the signed attributes DER-encoded as a
   * SET OF. In the token they carry the IMPLICIT [0] tag, and the two encodings
   * differ by exactly that one tag byte, so swapping it on a copy reproduces
   * the signed bytes without re-encoding anything.
   */
  const signedBytes = tokenDer.slice(signedAttrs.start, signedAttrs.end);
  signedBytes[0] = SET;

  const certificates = parseCertificates(tokenDer, certBlock);
  if (certificates.length === 0) return fail('no_certificates');
  const signature = Buffer.from(
    tokenDer.slice(signatureNode.contentStart, signatureNode.end),
  );

  // The signer is whichever supplied certificate may sign timestamps AND whose
  // key actually verifies these bytes. Identifying it by the signature itself
  // needs no SignerIdentifier parsing and cannot pick the wrong certificate.
  const signer = certificates.find((candidate) => {
    if (!allowsTimeStamping(candidate)) return false;
    try {
      return cryptoVerify(
        signatureDigest,
        signedBytes,
        candidate.publicKey,
        signature,
      );
    } catch {
      return false;
    }
  });
  if (!signer) return fail('signature_invalid');

  // A certificate cannot vouch for a moment outside its own lifetime.
  const notBefore = new Date(signer.validFrom);
  const notAfter = new Date(signer.validTo);
  if (tst.genTime < notBefore || tst.genTime > notAfter) {
    return fail('outside_certificate_validity');
  }

  const { anchor, ok } = resolveAnchor(signer, certificates);
  if (!ok) return fail('broken_chain');
  const anchorFingerprint = fingerprintOf(anchor);

  return {
    valid: true,
    genTime: tst.genTime.toISOString(),
    authority: commonName(signer),
    anchorFingerprint,
    trusted: trustedAnchors().has(anchorFingerprint),
  };
}

/** Same check, from the base64 form the certificate carries. */
export function verifyTimeStampTokenBase64(
  tokenBase64: string,
  expectedImprintHex: string,
): TimestampCheck {
  let der: Uint8Array;
  try {
    der = Uint8Array.from(Buffer.from(tokenBase64, 'base64'));
  } catch {
    return fail('malformed');
  }
  if (der.length === 0) return fail('malformed');
  return verifyTimeStampToken(der, expectedImprintHex);
}
