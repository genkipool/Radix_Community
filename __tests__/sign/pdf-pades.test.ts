// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import forge from 'node-forge';
import { embedCertificateInPdf } from '@/features/sign/lib/pdf-embed';
import { extractRadixAttachments } from '@/features/sign/lib/pdf-extract';
import {
  signPdfWithP12,
  verifyP12Password,
  readP12Info,
} from '@/features/sign/lib/pdf-pades';
import { blake2b256Hex } from '@/features/sign/lib/hash';
import type { AttestationEnvelope } from '@/features/sign/types/sign.types';

/** A throwaway self-signed cert + key packaged as a PKCS#12 (DER bytes). */
function makeP12(passphrase: string): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  const attrs = [
    { name: 'commonName', value: 'Kyusang Cho' },
    { name: 'organizationName', value: 'Enviogt' },
    { name: 'countryName', value: 'GT' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: '3des',
  });
  const der = forge.asn1.toDer(asn1).getBytes();
  const out = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i += 1) out[i] = der.charCodeAt(i);
  return out;
}

async function basePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595.28, 841.89]).drawText('contract', { x: 60, y: 760, size: 14, font });
  return doc.save();
}

describe('PAdES / X.509 signing (Phase 2)', () => {
  it('signs a Radix PDF while preserving the embedded certificate + original', async () => {
    const original = new TextEncoder().encode('the original document bytes');
    const docHash = blake2b256Hex(original);
    const envelope: AttestationEnvelope = {
      payload: {
        v: 1, docHash, hashAlg: 'blake2b-256', fileName: 'contract.pdf',
        fileSize: original.length, message: 'I am the author of this document',
        disclosure: 'full_name', email: false, signers: [],
        timestamp: '2026-07-24T09:00:00.000Z', networkId: 1, nonce: 'b'.repeat(64),
      },
      signatures: [{
        signerAccount: 'account_rdx12yy8p2v6z9k3xqe4m7c5n8w0r1t2u3i4o5p6a7s8d9f0',
        disclosedName: 'Kyusang Cho', disclosedEmail: null,
        proof: { publicKey: 'ab', signature: 'cd', curve: 'curve25519' },
        signedAt: '2026-07-24T09:00:05.000Z',
      }],
      onChain: null, request: null,
    };

    const base = await basePdf();
    const radixPdf = await embedCertificateInPdf(base, envelope, original);

    const p12 = makeP12('secret');
    const signed = await signPdfWithP12({
      pdfBytes: radixPdf,
      p12Bytes: p12,
      passphrase: 'secret',
      reason: 'I am the author of this document',
      location: 'Guatemala',
    });

    // 1) A real PAdES signature is present (ByteRange + detached PKCS#7).
    const asText = Buffer.from(signed).toString('latin1');
    expect(asText).toContain('/ByteRange');
    expect(asText).toContain('adbe.pkcs7.detached');
    expect(asText).toContain('/Type /Sig');

    // 2) The Radix layer survived: the embedded original still re-hashes to the
    //    signed document hash, and the certificate is intact.
    const att = await extractRadixAttachments(signed);
    expect(att.envelope?.payload.docHash).toBe(docHash);
    expect(att.originalBytes).not.toBeNull();
    expect(blake2b256Hex(att.originalBytes!)).toBe(docHash);
  });

  it('rejects a wrong passphrase', async () => {
    const base = await basePdf();
    const p12 = makeP12('secret');
    await expect(
      signPdfWithP12({ pdfBytes: base, p12Bytes: p12, passphrase: 'wrong' }),
    ).rejects.toBeTruthy();
  });

  it('verifyP12Password accepts the right password and rejects wrong/garbage', async () => {
    const p12 = makeP12('secret');
    expect(await verifyP12Password(p12, 'secret')).toBe(true);
    expect(await verifyP12Password(p12, 'nope')).toBe(false);
    expect(await verifyP12Password(new Uint8Array([1, 2, 3, 4]), 'secret')).toBe(false);
  });

  it('readP12Info extracts the certificate identity for the visible page', async () => {
    const info = await readP12Info(makeP12('secret'), 'secret');
    expect(info).not.toBeNull();
    expect(info!.subjectCN).toBe('Kyusang Cho');
    expect(info!.subjectO).toBe('Enviogt');
    expect(info!.issuer).toBe('Kyusang Cho'); // self-signed: issuer === subject
    expect(info!.serialNumber).toBeTruthy();
    expect(info!.validTo.getTime()).toBeGreaterThan(info!.validFrom.getTime());
    // Wrong password yields no identity at all (this IS the validation path).
    expect(await readP12Info(makeP12('secret'), 'nope')).toBeNull();
  });
});
