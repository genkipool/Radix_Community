import { describe, it, expect, afterEach, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import en from '@/features/sign/locales/en.json';
import {
  appendSignaturePage,
  parseColor,
  type CertificatePageOptions,
} from '@/features/sign/lib/pdf-signature-page';
import type { AttestationEnvelope } from '@/features/sign/types/sign.types';

const opts: CertificatePageOptions = {
  labels: en.sign.certificatePage,
  verifyUrl: 'https://example.org/en/console/sign-document?tab=verify',
  networkName: 'Mainnet',
  locale: 'en-US',
};

function baseEnvelope(): AttestationEnvelope {
  return {
    payload: {
      v: 1,
      docHash: 'a'.repeat(64),
      hashAlg: 'blake2b-256',
      fileName: 'agreement.pdf',
      fileSize: 187654,
      message: 'I am the author of this document',
      disclosure: 'full_name',
      email: true,
      signers: [],
      timestamp: '2026-07-23T09:21:05.000Z',
      networkId: 1,
      nonce: 'b'.repeat(64),
    },
    signatures: [
      {
        signerAccount: 'account_rdx12yy8p2v6z9k3xqe4m7c5n8w0r1t2u3i4o5p6a7s8d9f0',
        disclosedName: 'Kyusang Cho',
        disclosedEmail: 'kyusang@example.com',
        proof: { publicKey: 'ab', signature: 'cd', curve: 'curve25519' },
        signedAt: '2026-07-23T09:21:05.000Z',
      },
    ],
    onChain: null,
    request: null,
  };
}

/**
 * Makes the issuer-logo download fail instantly instead of going out to the
 * network. The behaviour under test is "a logo that cannot be fetched is
 * dropped and the rest of the block still renders", which says nothing about
 * how long a real DNS failure takes. Relying on the network for it made this
 * file flaky: under parallel load the lookup plus the PDF work occasionally
 * ran past the 5s test budget.
 */
function stubFailingImageFetch() {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network disabled in tests'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

async function emptyDoc(pages = 1): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i += 1)
    doc.addPage([595.28, 841.89]).drawText(`page ${i + 1}`, { x: 60, y: 760, size: 12, font });
  return doc;
}

describe('visible signature certificate page', () => {
  it('appends at least one page and stays a valid, reloadable PDF', async () => {
    const doc = await emptyDoc(1);
    const before = doc.getPageCount();
    await appendSignaturePage(doc, baseEnvelope(), opts);
    expect(doc.getPageCount()).toBeGreaterThan(before);

    // Re-serialising and re-loading proves the drawn text + embedded QR produced
    // structurally valid PDF objects (not just an in-memory doc).
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(doc.getPageCount());
  });

  it('renders the issuer organisation (with a brand accent) when supplied', async () => {
    // The logo fetch fails and is dropped; the rest of the block still renders.
    stubFailingImageFetch();
    const doc = await emptyDoc(1);
    await appendSignaturePage(doc, baseEnvelope(), {
      ...opts,
      issuer: {
        orgName: 'Enviogt',
        orgWebsite: 'https://enviogt.example',
        iconUrl: 'https://enviogt.example/logo.png',
      },
      accent: [0.83, 0.69, 0.22], // gold, exercises the light-band text path
    });
    const reloaded = await PDFDocument.load(await doc.save());
    expect(reloaded.getPageCount()).toBe(doc.getPageCount());
  });

  it("renders each signer's certificate record and the PAdES note", async () => {
    const env = baseEnvelope();
    env.signatures[0].certificate = {
      subjectCN: 'Kyusang Cho',
      subjectO: 'Enviogt',
      issuer: 'AC FNMT Usuarios',
      serialNumber: '00a1b2c3',
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: '2027-01-01T00:00:00.000Z',
    };
    const doc = await emptyDoc(1);
    const before = doc.getPageCount();
    await appendSignaturePage(doc, env, { ...opts, padesSigned: true });
    expect(doc.getPageCount()).toBeGreaterThan(before);
    const reloaded = await PDFDocument.load(await doc.save());
    expect(reloaded.getPageCount()).toBe(doc.getPageCount());
  });

  it('lists the signers still pending on a partially-signed document', async () => {
    const env = baseEnvelope();
    // Two required signers, only the first has signed.
    env.payload.signers = [
      env.signatures[0].signerAccount,
      'account_rdx12pending000000000000000000000000000000000',
    ];
    const doc = await emptyDoc(1);
    await appendSignaturePage(doc, env, opts);
    const reloaded = await PDFDocument.load(await doc.save());
    expect(reloaded.getPageCount()).toBe(doc.getPageCount());
  });

  it('parses theme colours (#hex and rgb())', () => {
    expect(parseColor('#4f46e5')).toEqual([0x4f / 255, 0x46 / 255, 0xe5 / 255]);
    expect(parseColor('#fff')).toEqual([1, 1, 1]);
    expect(parseColor('rgb(0, 82, 255)')).toEqual([0, 82 / 255, 1]);
    expect(parseColor('not-a-color')).toBeNull();
  });

  it('paginates when there are many signers (never overflows off the page)', async () => {
    const env = baseEnvelope();
    env.signatures = Array.from({ length: 8 }, (_, i) => ({
      signerAccount: `account_rdx12signer${i}00000000000000000000000000000000`,
      disclosedName: i % 2 === 0 ? `Signer ${i}` : null,
      disclosedEmail: null,
      proof: { publicKey: 'ab', signature: 'cd', curve: 'curve25519' as const },
      signedAt: '2026-07-23T09:21:05.000Z',
    }));
    const doc = await emptyDoc(1);
    await appendSignaturePage(doc, env, opts);
    // 8 signers push past one page: the cursor must have added continuation pages.
    expect(doc.getPageCount()).toBeGreaterThan(2);
    const reloaded = await PDFDocument.load(await doc.save());
    expect(reloaded.getPageCount()).toBe(doc.getPageCount());
  });
});
