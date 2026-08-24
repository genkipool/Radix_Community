import { describe, it, expect, afterEach, vi } from 'vitest';
import { inflateSync } from 'node:zlib';
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

/**
 * Every string the saved PDF actually SHOWS, in draw order. pdf-lib compresses
 * its content streams and writes text as hex, so reading the bytes for a word
 * finds nothing; this inflates each stream and decodes the `<hex> Tj` operands,
 * which is as close as a test gets to what a reader sees on the page.
 */
async function pageText(doc: PDFDocument): Promise<string> {
  const raw = Buffer.from(await doc.save({ useObjectStreams: false }));
  const out: string[] = [];
  for (let i = 0; ; ) {
    const open = raw.indexOf('stream', i);
    if (open < 0) break;
    let start = open + 'stream'.length;
    if (raw[start] === 0x0d) start += 1;
    if (raw[start] === 0x0a) start += 1;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    i = end + 'endstream'.length;
    let content: string;
    try {
      content = inflateSync(raw.subarray(start, end)).toString('latin1');
    } catch {
      continue; // Fonts, images and the QR: not text operators.
    }
    for (const [, hex] of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      out.push(Buffer.from(hex, 'hex').toString('latin1'));
    }
  }
  return out.join('\n');
}

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

  /**
   * A signature that lives on the ledger is only checkable if the reader can
   * reach the transaction that recorded it. Printing the id is half of that;
   * the other half is that it opens THIS deployment's explorer from inside the
   * PDF, on whatever machine the document ends up on — which is why the link
   * has to be absolute and only exists when the origin is known.
   */
  describe('on-ledger transaction links', () => {
    const ORIGIN = 'https://radix.example';
    const REQUEST_TX = 'txid_rdx1request00000000000000000000000000000000';
    const SIGNATURE_TX = 'txid_rdx1signature000000000000000000000000000000';

    function ledgerEnvelope(): AttestationEnvelope {
      const env = baseEnvelope();
      env.request = {
        networkId: 1,
        requestId: 'resource_rdx1collection000000000000000000000:#1#',
        transactionIntentHash: REQUEST_TX,
      };
      env.signatures[0].transactionIntentHash = SIGNATURE_TX;
      return env;
    }

    /**
     * Every URI an annotation points at, read back from the SAVED bytes — the
     * only thing a PDF reader ever sees. Object streams are off so the
     * annotations stay legible to the regex; they change nothing about what is
     * written, only how it is packed.
     */
    async function annotationUris(doc: PDFDocument): Promise<string[]> {
      const raw = new TextDecoder('latin1').decode(
        await doc.save({ useObjectStreams: false }),
      );
      return [...raw.matchAll(/\/URI\s*\(([^)]*)\)/g)].map((m) => m[1]);
    }

    it("links both transactions into this deployment's explorer", async () => {
      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, ledgerEnvelope(), { ...opts, origin: ORIGIN });
      const uris = await annotationUris(doc);
      // Each link names the ledger: a certificate is read on somebody else's
      // machine, where the last-used network is anybody's guess.
      expect(uris).toContain(
        `${ORIGIN}/en-US/dashboard/tx/${REQUEST_TX}?network=mainnet`,
      );
      expect(uris).toContain(
        `${ORIGIN}/en-US/dashboard/tx/${SIGNATURE_TX}?network=mainnet`,
      );
    });

    it('links a Stokenet certificate into Stokenet', async () => {
      // The one that used to break: a test-ledger hash opened on Mainnet, where
      // it does not exist. The certificate's own network decides.
      const env = ledgerEnvelope();
      env.payload.networkId = 2;
      const stokenetTx = 'txid_tdx_2_1request0000000000000000000000000000';
      env.request!.networkId = 2;
      env.request!.transactionIntentHash = stokenetTx;
      env.signatures[0].transactionIntentHash = stokenetTx;

      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, env, {
        ...opts,
        origin: ORIGIN,
        networkName: 'Stokenet',
        network: 'stokenet',
      });
      const uris = await annotationUris(doc);
      expect(uris).toContain(
        `${ORIGIN}/en-US/dashboard/tx/${stokenetTx}?network=stokenet`,
      );
      expect(uris.some((u) => u.includes('network=mainnet'))).toBe(false);
    });

    it('still prints the ids when the origin is unknown, with no dead links', async () => {
      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, ledgerEnvelope(), opts);
      const uris = await annotationUris(doc);
      expect(uris.some((u) => u.includes(REQUEST_TX))).toBe(false);
      expect(uris.some((u) => u.includes(SIGNATURE_TX))).toBe(false);
      // The page itself is unaffected: it renders and reloads as always.
      const reloaded = await PDFDocument.load(await doc.save());
      expect(reloaded.getPageCount()).toBe(doc.getPageCount());
    });

    it('adds no transaction link to a certificate that has none', async () => {
      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, baseEnvelope(), { ...opts, origin: ORIGIN });
      const uris = await annotationUris(doc);
      expect(uris.some((u) => u.includes('/dashboard/tx/'))).toBe(false);
    });

    it('makes the verify address itself clickable, whole', async () => {
      // It wraps over several lines, and half a URL copied by hand opens
      // nothing — so every line of it carries the complete address.
      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, ledgerEnvelope(), { ...opts, origin: ORIGIN });
      const uris = await annotationUris(doc);
      expect(uris).toContain(opts.verifyUrl);
    });
  });

  /**
   * A signature's own evidence is the NFT minted for it. The page named the
   * signer and the mint transaction but never that token, so a reader had no
   * address to look the signature up by.
   */
  describe("each signature's NFT", () => {
    const NFT = 'resource_rdx1signcollection00000000000000000:#7#';

    it('prints the NFT the signature carries', async () => {
      const env = baseEnvelope();
      env.signatures[0].signatureNft = NFT;
      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, env, opts);
      const text = await pageText(doc);
      expect(text).toContain(en.sign.certificatePage.signatureNft.toUpperCase());
      expect(text).toContain(NFT);
    });

    it('falls back to the anchor, which mints every signer at once', async () => {
      // A stand-alone anchor records the NFTs on itself rather than on each
      // signature, and the page must find them there too.
      const env = baseEnvelope();
      env.onChain = {
        networkId: 1,
        transactionIntentHash: 'txid_rdx1anchor0000000000000000000000000000',
        resourceAddress: 'resource_rdx1signcollection00000000000000000',
        sealAddress: '',
        nfts: [
          {
            signerAccount: env.signatures[0].signerAccount,
            nftGlobalId: NFT,
            localId: '#7#',
          },
        ],
      };
      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, env, opts);
      expect(await pageText(doc)).toContain(NFT);
    });

    it("names the collection above the address when the ledger has a name", async () => {
      const env = baseEnvelope();
      env.signatures[0].signatureNft = NFT;
      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, env, {
        ...opts,
        nftNames: { [NFT.split(':')[0]]: 'Firmas de Pruebas' },
      });
      const text = await pageText(doc);
      // Name first, address under it: the address identifies the token, the
      // name is what a reader recognises.
      expect(text).toContain('Firmas de Pruebas');
      expect(text.indexOf('Firmas de Pruebas')).toBeLessThan(text.indexOf(NFT));
    });

    it('prints no NFT line for an off-ledger signature', async () => {
      const doc = await emptyDoc(1);
      await appendSignaturePage(doc, baseEnvelope(), opts);
      expect(await pageText(doc)).not.toContain(
        en.sign.certificatePage.signatureNft.toUpperCase(),
      );
    });
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
