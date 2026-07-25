/**
 * Phase 2: wraps a finished Radix-embedded PDF in a standard PAdES / PKCS#7
 * digital signature using the SIGNER'S OWN X.509 certificate (a PKCS#12
 * bundle they provide). This is what makes Adobe/Foxit light up their native
 * "Signatures" panel and validate the certificate's DN, so the document is a
 * first-class citizen in legacy e-signature pipelines.
 *
 * Self-custody is preserved: the private key is inside the user's `.p12` and
 * the signature is computed HERE, in their browser. The key never leaves the
 * device and is never uploaded. It complements the Radix proof (ledger anchor +
 * embedded certificate stay inside the PDF); it does not replace it.
 *
 * Order matters: this MUST be the last modification. Any byte change after
 * signing breaks the signature, so callers apply the watermark, the visible
 * certificate page and the Radix attachments first, then sign here.
 *
 * The heavy crypto (`node-forge`, `@signpdf/*`) is dynamically imported so it
 * only enters the bundle when a user actually signs with a certificate.
 */

export interface PadesSignInput {
  /** The final Radix PDF bytes (attachments + visible page already inside). */
  pdfBytes: Uint8Array;
  /** PKCS#12 (.p12/.pfx) bytes: the signer's certificate + private key. */
  p12Bytes: Uint8Array;
  /** Passphrase protecting the PKCS#12 bundle. */
  passphrase: string;
  /** Optional signature-dictionary fields (shown in the reader's panel). */
  reason?: string;
  location?: string;
  /** Signer/organisation name; when empty the reader uses the cert subject. */
  name?: string;
  contactInfo?: string;
  /** Signing time; defaults to now. */
  signingTime?: Date;
}

/**
 * `@signpdf` and `node-forge` expect Node's `Buffer`. Next.js does not polyfill
 * it in the browser, so we lazily install the `buffer` package as a global the
 * first time we sign (only when a user actually uses a certificate). No-op in
 * Node, where Buffer is native.
 */
async function ensureBuffer(): Promise<void> {
  if (typeof globalThis.Buffer === 'undefined') {
    const { Buffer } = await import('buffer');
    (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
  }
}

function toBuffer(bytes: Uint8Array): Uint8Array {
  return typeof Buffer !== 'undefined' ? Buffer.from(bytes) : bytes;
}

/** Human-readable identity read from the signing certificate. */
export interface P12Info {
  /** Subject common name (the signer). */
  subjectCN: string;
  /** Subject organisation, when present. */
  subjectO: string;
  /** Issuing CA (its common name, falling back to its organisation). */
  issuer: string;
  /** Certificate validity window. */
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
}

function certField(
  subject: { getField(name: string): { value?: string } | null },
  name: string,
): string {
  return subject.getField(name)?.value ?? '';
}

/**
 * Opens the PKCS#12 bundle with `passphrase` and returns the signing
 * certificate's identity, or null when the password is wrong or the file is not
 * a readable PKCS#12. Used both to validate the certificate up front (so the UI
 * can block signing before the wallet step) and to print the certificate's
 * details on the visible signature page.
 */
export async function readP12Info(
  p12Bytes: Uint8Array,
  passphrase: string,
): Promise<P12Info | null> {
  await ensureBuffer();
  const forge = (await import('node-forge')).default;
  try {
    let binary = '';
    for (let i = 0; i < p12Bytes.length; i += 1) {
      binary += String.fromCharCode(p12Bytes[i]);
    }
    const asn1 = forge.asn1.fromDer(binary);
    // Throws "PKCS#12 MAC could not be verified. Invalid password?" on a wrong
    // passphrase, and other parse errors on a malformed / non-p12 file.
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = (bags[forge.pki.oids.certBag] ?? [])
      .map((b) => b.cert)
      .filter((c): c is NonNullable<typeof c> => !!c);
    if (certs.length === 0) return null;
    // A bundle usually carries the leaf plus its CA chain; the signer is the
    // leaf, so prefer a certificate that is not itself a CA.
    const leaf =
      certs.find((c) => {
        const bc = c.getExtension('basicConstraints') as { cA?: boolean } | undefined;
        return !bc?.cA;
      }) ?? certs[0];
    return {
      subjectCN: certField(leaf.subject, 'CN'),
      subjectO: certField(leaf.subject, 'O'),
      issuer: certField(leaf.issuer, 'CN') || certField(leaf.issuer, 'O'),
      validFrom: leaf.validity.notBefore,
      validTo: leaf.validity.notAfter,
      serialNumber: leaf.serialNumber,
    };
  } catch {
    return null;
  }
}

/**
 * Cheaply checks whether `passphrase` opens the PKCS#12 bundle, WITHOUT signing
 * anything. Returns false on a wrong password OR an unreadable file.
 */
export async function verifyP12Password(
  p12Bytes: Uint8Array,
  passphrase: string,
): Promise<boolean> {
  return (await readP12Info(p12Bytes, passphrase)) !== null;
}

/**
 * Returns PAdES-signed PDF bytes. Adds an (invisible) signature field with a
 * ByteRange placeholder, then fills it with a detached PKCS#7 signature made
 * from the provided certificate. Throws on a bad PDF / wrong passphrase /
 * malformed certificate, so callers can surface a precise error.
 */
export async function signPdfWithP12(input: PadesSignInput): Promise<Uint8Array> {
  await ensureBuffer();
  const [{ PDFDocument }, placeholderMod, signpdfMod, signerMod] =
    await Promise.all([
      import('pdf-lib'),
      import('@signpdf/placeholder-pdf-lib'),
      import('@signpdf/signpdf'),
      import('@signpdf/signer-p12'),
    ]);
  const { pdflibAddPlaceholder } = placeholderMod;
  const signpdf = signpdfMod.default;
  const { P12Signer } = signerMod;

  // A signature must sit inside an AcroForm signature field with a ByteRange
  // placeholder; pdf-lib writes it, then @signpdf fills the placeholder.
  const pdfDoc = await PDFDocument.load(input.pdfBytes);
  pdflibAddPlaceholder({
    pdfDoc,
    reason: input.reason ?? '',
    contactInfo: input.contactInfo ?? '',
    name: input.name ?? '',
    location: input.location ?? '',
    signingTime: input.signingTime,
  });
  // Signing needs a plain xref table (no object streams) so the ByteRange can
  // be located and patched.
  const withPlaceholder = await pdfDoc.save({ useObjectStreams: false });

  const signer = new P12Signer(toBuffer(input.p12Bytes), {
    passphrase: input.passphrase,
  });
  const signed = await signpdf.sign(
    toBuffer(withPlaceholder),
    signer,
    input.signingTime,
  );
  return new Uint8Array(signed);
}
