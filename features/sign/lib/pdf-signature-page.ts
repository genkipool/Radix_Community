/**
 * Renders a VISIBLE "Signature Certificate" page and appends it as the last
 * page of a signed PDF (Phase 1 of the visible-signature work).
 *
 * Why a rendered page: Radix Seal already embeds the machine-readable
 * certificate as a PDF attachment (see pdf-embed.ts), but most viewers hide
 * attachments and Radix Seal is not a PAdES/X.509 signature, so nothing about
 * the signature shows on screen. This page makes the signature human-readable
 * WITHOUT any special viewer: who signed, when, the document hash, the network,
 * the on-ledger anchor, and a QR to the verifier.
 *
 * It is PRESENTATION ONLY. The page is drawn on the carrier PDF; the intact
 * ORIGINAL document is still embedded separately (pdf-embed.ts) and that is
 * what verification re-hashes, so adding this page never changes the document
 * hash. Nothing here is part of the trust model.
 *
 * Honesty: any disclosed name is SELF-DECLARED by the signer's wallet, never a
 * CA-verified legal identity, so the page says exactly that and never imitates
 * a qualified (eIDAS QES) signature appearance.
 */
import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from 'pdf-lib';
import type { AttestationEnvelope, SignatureEntry } from '../types/sign.types';
import type { SignDictionary } from '../types/dictionary';
import { NETWORKS, RadixNetworkId } from '@/features/wallet/constants/network';
import type { Network } from '@/features/dashboard/types';
import { SEAL_IMAGE_PATH } from '../constants/seal';
import { findCollectionIssuer, findCollectionProfile } from '../services/sealDiscovery';
import { explorerTxUrl } from './explorer';
import { buildShareUrl, parseRequestKey } from './share';
import { svgUrlToPngBytes, fetchImageBytes } from './pdf-watermark';
import { pdfSafeText } from './pdf-text';

/** An RGB triple in the 0..1 range that pdf-lib's colours use. */
type Rgb01 = [number, number, number];

/** pdf-lib's `rgb(r,g,b)` helper, injected so the Cursor stays synchronous. */
type RgbFn = (r: number, g: number, b: number) => RGB;

/**
 * Registers a clickable URI annotation over a rectangle of a page, injected for
 * the same reason as `RgbFn` (pdf-lib is imported dynamically).
 */
type LinkFn = (
  page: PDFPage,
  rect: [number, number, number, number],
  url: string,
) => void;

/** Localised strings for the page (supplied by the caller's dictionary). */
export interface CertificatePageLabels {
  title: string;
  tagline: string;
  documentSection: string;
  issuer: string;
  file: string;
  hash: string;
  network: string;
  /** When the attestation was created by the initiator (document section). */
  created: string;
  /** When a signer actually signed (per-signature). */
  signedAt: string;
  reason: string;
  signaturesSection: string;
  signedBy: string;
  account: string;
  email: string;
  selfDeclared: string;
  /** "3 of 5 required signatures" style summary. */
  signedCount: string;
  /** Still-missing required signers. */
  pendingSection: string;
  pendingNote: string;
  complete: string;
  anchorSection: string;
  anchorResource: string;
  anchorTx: string;
  anchorRequest: string;
  /** Transaction that created the on-ledger signing request. */
  anchorRequestTx: string;
  /** Per-signature transaction (multi-party on-ledger). */
  signatureTx: string;
  /** The signature NFT itself (per-signature, on-ledger). */
  signatureNft: string;
  /** Says, once, that the transaction ids on the page are clickable. */
  txLinkNote: string;
  anchorNote: string;
  /* Certificate (PAdES / X.509) section — one entry per signer that used one. */
  certSection: string;
  certSubject: string;
  certOrg: string;
  certIssuer: string;
  certValidity: string;
  certSerial: string;
  certNote: string;
  verifyTitle: string;
  verifyInstruction: string;
  /** Appended to the instruction ONLY when the certificate is on-ledger. */
  verifyInstructionLedger: string;
  disclaimerTitle: string;
  disclaimer: string;
  /** Appended to the disclaimer ONLY when the certificate is on-ledger. */
  disclaimerAnchored: string;
  generated: string;
  /** Says in as many words that the footer date is not a signing date. */
  generatedNote: string;
}

export interface CertificatePageOptions {
  labels: CertificatePageLabels;
  /** Full URL of the verification tool (encoded into the QR + shown as text). */
  verifyUrl: string;
  /** Human-readable network name (e.g. "Mainnet"). */
  networkName: string;
  /**
   * Ledger this certificate is anchored on, so every transaction link on the
   * page opens the explorer THERE. A PDF is read on somebody else's machine,
   * months later: without it the explorer falls back to their own last-used
   * network and a Stokenet transaction id opened on Mainnet, where it does not
   * exist. Undefined for a network with no explorer of its own, and the link
   * then falls back to what the hash itself names.
   */
  network?: Network;
  /** BCP-47 locale for date formatting. */
  locale: string;
  /** Same-origin path/URL of the seal SVG, rasterised for the header logo. */
  sealImageUrl?: string;
  /**
   * Absolute origin of this deployment, so every transaction id on the page can
   * be a working link into ITS OWN explorer. Without it the ids are still
   * printed, just not clickable (a PDF opened anywhere must not carry a
   * relative URL that resolves against whatever the reader has open).
   */
  origin?: string;
  /** Issuer identity read from the on-ledger collection (org name/site/logo). */
  issuer?: { orgName?: string; orgWebsite?: string; iconUrl?: string };
  /**
   * Name of each signing collection, keyed by its resource address, as the
   * ledger holds it. Printed above the signature NFT so a reader sees whose
   * collection minted the signature and not only a 60-character address. Read
   * from the ledger, never from the certificate: it is somebody's display name,
   * and the address beside it is what identifies the token.
   */
  nftNames?: Record<string, string>;
  /** Brand accent (0..1 RGB) read from the active theme; falls back to indigo. */
  accent?: Rgb01;
  /**
   * True when this PDF is about to be PAdES-signed, so the page can say the
   * file carries a standard PDF signature the reader validates. The certificate
   * DETAILS are printed per signer, read from the envelope (see
   * `SignerCertificate`), which is what makes them survive co-signing.
   */
  padesSigned?: boolean;
}

/**
 * The signature NFT backing one signature: an on-ledger request records it on
 * the signature itself (each signer mints into their OWN collection), while a
 * stand-alone anchor mints every signer's NFT in one transaction and lists them
 * on the anchor, so that is where it is looked up instead. Undefined for a
 * purely off-ledger signature, which has no token behind it.
 */
export function signatureNftOf(
  env: AttestationEnvelope,
  signature: SignatureEntry,
): string | undefined {
  return (
    signature.signatureNft ||
    env.onChain?.nfts.find((n) => n.signerAccount === signature.signerAccount)
      ?.nftGlobalId ||
    undefined
  );
}

/** The collection out of an NFT address: `resource_…:#7#` → `resource_…`. */
function nftResource(globalId: string): string {
  return globalId.split(':')[0] || globalId;
}

/**
 * The signing collection whose issuer identity to display: the initiator's
 * collection for an on-ledger request, otherwise the anchored collection. Null
 * for a purely off-ledger certificate (no on-ledger collection to read).
 */
function issuerCollection(env: AttestationEnvelope): string | null {
  if (env.request) return parseRequestKey(env.request.requestId)?.collection ?? null;
  return env.onChain?.resourceAddress ?? null;
}

/**
 * The address printed on the page (and encoded into its QR).
 *
 * For an on-ledger certificate it carries the request itself, so opening it —
 * from a phone, with no wallet and no upload — lands on the verifier with the
 * ledger check ALREADY running: who signed, when, and whether the set is
 * complete. It used to be the bare verify tab, which showed an empty dropzone
 * and left whoever scanned the QR with nothing verified.
 *
 * Off-ledger certificates keep the plain tab: nothing can be checked about them
 * until the document itself is dropped in, and promising otherwise would be a
 * worse link, not a better one.
 */
function verifyUrlFor(
  env: AttestationEnvelope,
  origin: string,
  locale: string,
): string {
  const base = `/${locale}/console/sign-document`;
  // No `net=`: a request link names its network in the resource prefix of the
  // key it carries, and this address is printed on paper and re-typed by hand,
  // so every character it does not need is one that can be got wrong.
  return env.request?.requestId
    ? buildShareUrl({
        origin,
        pathname: base,
        requestKey: env.request.requestId,
        tab: 'verify',
      })
    : `${origin}${base}?tab=verify`;
}

/**
 * The ledger's own name for every collection that minted a signature here, one
 * read per distinct collection (several signers can share none — each has their
 * own). Best-effort: a collection that cannot be read simply prints its address
 * alone, which is the part that identifies it anyway.
 */
async function signatureNftNames(
  env: AttestationEnvelope,
): Promise<Record<string, string>> {
  const resources = [
    ...new Set(
      env.signatures
        .map((s) => signatureNftOf(env, s))
        .filter((id): id is string => !!id)
        .map(nftResource),
    ),
  ];
  const named = await Promise.all(
    resources.map(async (resource) => {
      const profile = await findCollectionProfile(
        env.payload.networkId,
        resource,
      ).catch(() => null);
      return [resource, profile?.name?.trim() ?? ''] as const;
    }),
  );
  return Object.fromEntries(named.filter(([, name]) => name));
}

/** The explorer's name for a network id, or undefined when it has no page. */
function explorerNetworkOf(networkId: number): Network | undefined {
  if (networkId === RadixNetworkId.Mainnet) return 'mainnet';
  if (networkId === RadixNetworkId.Stokenet) return 'stokenet';
  return undefined;
}

/**
 * Builds the visible signature-certificate page options for an embedded PDF:
 * localised labels, the certificate's own network name, a verify URL (also
 * encoded into the page's QR), and — when the certificate is on-ledger — the
 * issuer's organisation read from the collection metadata. Async because that
 * issuer lookup reads the ledger; best-effort, so a gateway hiccup just omits
 * the issuer line. Co-located with the renderer so every call site shares one
 * source of truth.
 */
export async function signaturePageOptions(
  env: AttestationEnvelope,
  t: SignDictionary,
  locale: string,
  /** True when the delivered PDF will also carry a PAdES signature. */
  padesSigned?: boolean,
): Promise<CertificatePageOptions> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const collection = issuerCollection(env);
  const issuer = collection
    ? (await findCollectionIssuer(env.payload.networkId, collection).catch(
        () => null,
      )) ?? undefined
    : undefined;
  return {
    nftNames: await signatureNftNames(env),
    labels: t.certificatePage,
    verifyUrl: verifyUrlFor(env, origin, locale),
    networkName:
      NETWORKS[env.payload.networkId]?.networkName ?? `#${env.payload.networkId}`,
    network: explorerNetworkOf(env.payload.networkId),
    locale,
    sealImageUrl: origin ? `${origin}${SEAL_IMAGE_PATH}` : undefined,
    origin: origin || undefined,
    issuer,
    accent: readBrandAccent(),
    padesSigned,
  };
}

// ─── Layout constants (A4 portrait, points) ──────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Side of the header seal in points, and the PNG it is rasterised from. */
const SEAL_LOGO_SIZE = 44;
const SEAL_LOGO_RASTER = 512;

const INK: Rgb01 = [0.11, 0.13, 0.2];
const MUTED: Rgb01 = [0.42, 0.45, 0.55];
/** Default accent (indigo) when the theme's brand colour can't be read. */
const ACCENT: Rgb01 = [0.29, 0.33, 0.92];
const LINE: Rgb01 = [0.86, 0.88, 0.93];
const WHITE: Rgb01 = [1, 1, 1];

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** Parses `#rgb`, `#rrggbb` or `rgb(r,g,b)` into a 0..1 triple, or null. */
export function parseColor(css: string): Rgb01 | null {
  const s = css.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as Rgb01;
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((v) =>
      Math.min(1, v / 255),
    ) as Rgb01;
  }
  return null;
}

/** Rough relative luminance (0..1), enough to choose readable text colours. */
function luminance([r, g, b]: Rgb01): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Darkens a colour just enough to stay readable as text on a white page. */
function readableOnWhite(c: Rgb01): Rgb01 {
  const l = luminance(c);
  if (l <= 0.45) return c;
  const f = 0.45 / l;
  return [c[0] * f, c[1] * f, c[2] * f];
}

// ─── Small helpers ────────────────────────────────────────────────────────────

/** Wraps text to `maxWidth`, breaking over-long tokens (hashes, addresses). */
function wrapLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // A single token wider than the line (hash/address): hard-break it.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = '';
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            out.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

function base64PngToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function shortAccount(account: string): string {
  return account.length > 24
    ? `${account.slice(0, 11)}…${account.slice(-6)}`
    : account;
}

/**
 * How a signer is named on the certificate: the name their wallet disclosed
 * (full name, else the persona's nickname or label — see
 * `extractDisclosedName`), and only when there is none, the account address.
 * An address is a correct answer but a poor one, so it is the last resort, not
 * the first. The full address is printed underneath either way.
 */
function signerLabel(signature: { disclosedName: string | null; signerAccount: string }): string {
  return signature.disclosedName?.trim() || shortAccount(signature.signerAccount);
}

function fmtDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale);
}

/**
 * Loads a (possibly cross-origin) image URL into a pdf-lib image. SVGs are
 * rasterised via canvas; PNG/JPG bytes are fetched directly. Best-effort: any
 * CORS/parse failure returns null so the issuer logo is simply omitted.
 */
async function embedRemoteImage(
  pdfDoc: PDFDocument,
  url: string,
): Promise<PDFImage | null> {
  try {
    const lower = url.toLowerCase();
    const isSvg = lower.endsWith('.svg') || lower.startsWith('data:image/svg');
    const bytes = isSvg ? await svgUrlToPngBytes(url, 256) : await fetchImageBytes(url);
    if (!bytes) return null;
    const isJpg =
      /\.jpe?g($|\?)/.test(lower) || lower.startsWith('data:image/jpeg');
    return isJpg
      ? await pdfDoc.embedJpg(bytes as Uint8Array<ArrayBuffer>).catch(() => null)
      : await pdfDoc.embedPng(bytes as Uint8Array<ArrayBuffer>).catch(() => null);
  } catch {
    return null;
  }
}

/**
 * Reads the active theme's brand colour (`--color-primary`) as a 0..1 RGB
 * triple, for tinting the certificate. Undefined outside the browser or when
 * the value can't be parsed, so the renderer falls back to its default accent.
 */
export function readBrandAccent(): Rgb01 | undefined {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function')
    return undefined;
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary')
      .trim();
    return parseColor(value) ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── The renderer ─────────────────────────────────────────────────────────────

/**
 * A tiny top-down cursor over one or more appended pages. Adds a fresh page
 * when the content runs past the bottom margin, so many signers never overflow.
 */
class Cursor {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private fonts: { regular: PDFFont; bold: PDFFont },
    private rgbFn: RgbFn,
    /** Accent already darkened to stay readable on the white page. */
    private accentInk: Rgb01,
    private linkFn: LinkFn,
  ) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private rgb(c: [number, number, number]): RGB {
    return this.rgbFn(c[0], c[1], c[2]);
  }

  ensure(space: number) {
    if (this.y - space < MARGIN) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.y = PAGE_H - MARGIN;
    }
  }

  gap(h: number) {
    this.y -= h;
  }

  /** Draws wrapped text at the cursor and advances past it. */
  text(
    value: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      x?: number;
      maxWidth?: number;
      lineGap?: number;
      /** Makes every line of this text a clickable link to `url`. */
      link?: string;
    } = {},
  ) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const x = opts.x ?? MARGIN;
    const maxWidth = opts.maxWidth ?? CONTENT_W - (x - MARGIN);
    const lineHeight = size * 1.35;
    // Every string the page draws funnels through here, ours and other
    // people's alike, so this is the one place the sanitiser has to be for it
    // not to be forgotten later. Our own labels are plain ASCII and hold no
    // line breaks, so passing them through costs nothing. See pdf-text.ts.
    const lines = wrapLines(pdfSafeText(value, 600), font, size, maxWidth);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.page.drawText(line, {
        x,
        y: this.y - size,
        size,
        font,
        color: this.rgb(opts.color ?? INK),
      });
      // One annotation per LINE: a long hash wraps, and a single rectangle
      // around the block would swallow the whitespace beside the short line.
      if (opts.link) {
        const width = font.widthOfTextAtSize(line, size);
        this.linkFn(
          this.page,
          [x, this.y - size - size * 0.2, x + width, this.y + size * 0.15],
          opts.link,
        );
      }
      this.y -= lineHeight;
    }
    if (opts.lineGap) this.y -= opts.lineGap;
  }

  /** A "Label: value" field where the label is muted and value wraps below. */
  field(
    label: string,
    value: string,
    opts: {
      mono?: boolean;
      link?: string;
      color?: Rgb01;
      /**
       * A readable line drawn between the label and the value — a resource's
       * name above its address. Skipped when empty, so the field looks exactly
       * as it always did whenever there is no name to show.
       */
      lead?: string;
    } = {},
  ) {
    this.text(label.toUpperCase(), { size: 7.5, bold: true, color: MUTED });
    this.gap(1);
    if (opts.lead) {
      this.text(opts.lead, { size: 10.5 });
      this.gap(1);
    }
    this.text(value, {
      size: opts.mono ? 9 : 10.5,
      link: opts.link,
      color: opts.color,
    });
    this.gap(6);
  }

  sectionTitle(label: string) {
    this.ensure(30);
    this.gap(6);
    this.text(label, { size: 12, bold: true, color: this.accentInk });
    this.gap(3);
    this.rule();
    this.gap(6);
  }

  rule() {
    this.ensure(2);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.75,
      color: this.rgb(LINE),
    });
    this.y -= 2;
  }
}

/**
 * Appends the visible signature-certificate page(s) to `pdfDoc`. Best-effort:
 * the caller wraps this so a font/QR/logo hiccup never blocks the (attachment)
 * embedding. Renders nothing meaningful only if the whole draw throws.
 */
export async function appendSignaturePage(
  pdfDoc: PDFDocument,
  envelope: AttestationEnvelope,
  opts: CertificatePageOptions,
): Promise<void> {
  const { PDFName, PDFString, StandardFonts, rgb } = await import('pdf-lib');
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { labels: L, locale } = opts;
  const { payload } = envelope;

  /** Adds a bare (border-less) URI link over a rectangle of a page. */
  const addLink: LinkFn = (page, rect, url) => {
    const ref = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: rect,
        // No visible frame: the accent-coloured text is the affordance.
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
      }),
    );
    const annots = page.node.Annots();
    if (annots) annots.push(ref);
    else page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([ref]));
  };

  /**
   * This deployment's explorer page for a transaction, or undefined when the
   * origin is unknown — an unlinked id is still a complete record, a link to
   * nowhere is not.
   */
  const txLink = (hash?: string | null): string | undefined =>
    hash && opts.origin
      ? explorerTxUrl(locale, hash, { origin: opts.origin, network: opts.network })
      : undefined;


  // Brand accent (from the active theme) tints the band, section titles and
  // links; the page stays white with dark ink, so it prints cleanly whatever
  // the signer's theme. `accentInk` is darkened enough to read on white; the
  // band picks light or dark text from the accent's own luminance.
  const accent: Rgb01 = opts.accent ?? ACCENT;
  const accentInk = readableOnWhite(accent);
  const lightBand = luminance(accent) > 0.6;
  const bandText: Rgb01 = lightBand ? INK : WHITE;
  const bandSubText: Rgb01 = lightBand ? MUTED : [0.9, 0.91, 0.98];

  const cur = new Cursor(pdfDoc, { regular, bold }, rgb, accentInk, addLink);

  // ── Header band ──
  const bandH = 74;
  const bandY = PAGE_H - bandH;
  cur.page.drawRectangle({
    x: 0,
    y: bandY,
    width: PAGE_W,
    height: bandH,
    color: rgb(accent[0], accent[1], accent[2]),
  });

  // Seal logo (optional; skipped silently if it can't be rasterised). Drawn
  // small but rasterised large: the old 200 px across a 40 pt mark is barely
  // above screen resolution, and the seal's rings turned to mush in print.
  let logoRight = MARGIN;
  if (opts.sealImageUrl) {
    try {
      const png = await svgUrlToPngBytes(opts.sealImageUrl, SEAL_LOGO_RASTER);
      if (png) {
        const img = await pdfDoc.embedPng(png as Uint8Array<ArrayBuffer>);
        const dim = SEAL_LOGO_SIZE;
        cur.page.drawImage(img, {
          x: MARGIN,
          y: bandY + (bandH - dim) / 2,
          width: dim,
          height: dim,
        });
        logoRight = MARGIN + dim + 14;
      }
    } catch {
      // No logo — the title alone is fine.
    }
  }
  cur.page.drawText(L.title, {
    x: logoRight,
    y: bandY + bandH - 34,
    size: 20,
    font: bold,
    color: rgb(bandText[0], bandText[1], bandText[2]),
  });
  cur.page.drawText(L.tagline, {
    x: logoRight,
    y: bandY + bandH - 52,
    size: 9,
    font: regular,
    color: rgb(bandSubText[0], bandSubText[1], bandSubText[2]),
  });

  cur.y = bandY - 22;

  // ── Document section ──
  cur.sectionTitle(L.documentSection);
  // Issuer first (when the on-ledger collection declares one): "which
  // institution issued it" is what signers most want to see. The issuer's own
  // logo (collection `icon_url`) sits beside the name; best-effort, so a
  // cross-origin fetch that fails just drops the image.
  if (opts.issuer && (opts.issuer.orgName || opts.issuer.orgWebsite)) {
    cur.text(L.issuer.toUpperCase(), { size: 7.5, bold: true, color: MUTED });
    cur.gap(2);
    const logo = opts.issuer.iconUrl
      ? await embedRemoteImage(pdfDoc, opts.issuer.iconUrl)
      : null;
    if (logo && opts.issuer.orgName) {
      const box = 26;
      cur.ensure(box);
      const top = cur.y;
      const dim = logo.scaleToFit(box, box);
      cur.page.drawImage(logo, {
        x: MARGIN,
        y: top - box + (box - dim.height) / 2,
        width: dim.width,
        height: dim.height,
      });
      // Drawn straight onto the page rather than through the cursor (it sits
      // beside the logo), so it needs the sanitiser applied by hand: the
      // organisation name is ledger metadata, i.e. someone else's text.
      cur.page.drawText(pdfSafeText(opts.issuer.orgName, 80), {
        x: MARGIN + box + 10,
        y: top - box / 2 - 4,
        size: 12,
        font: bold,
        color: rgb(INK[0], INK[1], INK[2]),
      });
      cur.y = top - box;
      cur.gap(4);
    } else if (opts.issuer.orgName) {
      cur.text(opts.issuer.orgName, { size: 11, bold: true });
    }
    if (opts.issuer.orgWebsite)
      cur.text(opts.issuer.orgWebsite, { size: 9, color: accentInk });
    cur.gap(6);
  }
  cur.field(L.file, payload.fileName || '—');
  // Whether this certificate has a ledger side at all. Everything the page
  // says about the ledger — the anchor block, the permanence claim, the "reads
  // the public ledger" instruction — hangs off this and nothing else.
  const anchored = !!envelope.onChain || !!envelope.request;

  cur.field(L.hash, payload.docHash, { mono: true });
  cur.field(L.network, opts.networkName);
  cur.field(L.created, fmtDate(payload.timestamp, locale));
  if (payload.message.trim()) cur.field(L.reason, payload.message.trim());

  // ── Signatures section ──
  // Who actually signed vs. who still has to, so a partially-signed document
  // says so on its face instead of looking finished.
  //
  // The roster is required ∪ already-signed, NOT the required list alone: when
  // signing off-ledger the initiator's own account is not in `payload.signers`
  // (it is unknown when the challenge is derived), so counting only the
  // required list read as "1 of 1" while two people had actually signed.
  const signedAccounts = new Set(envelope.signatures.map((s) => s.signerAccount));
  const required = payload.signers;
  const roster = [...new Set([...required, ...signedAccounts])];
  const pending = roster.filter((a) => !signedAccounts.has(a));
  const isComplete = pending.length === 0;

  cur.sectionTitle(`${L.signaturesSection} (${envelope.signatures.length})`);
  if (roster.length > 1 || pending.length > 0) {
    cur.text(
      L.signedCount
        .replace('{signed}', String(signedAccounts.size))
        .replace('{total}', String(roster.length)),
      { size: 9, bold: true, color: isComplete ? accentInk : MUTED },
    );
    cur.gap(5);
  }
  envelope.signatures.forEach((s, i) => {
    const name = s.disclosedName?.trim();
    cur.text(`${L.signedBy}: ${signerLabel(s)}`, {
      size: 11.5,
      bold: true,
    });
    cur.gap(3);
    if (name) {
      cur.text(L.selfDeclared, { size: 7.5, color: MUTED });
      cur.gap(2);
    }
    cur.field(L.account, s.signerAccount, { mono: true });
    if (s.disclosedEmail?.trim()) cur.field(L.email, s.disclosedEmail.trim());
    cur.field(L.signedAt, fmtDate(s.signedAt, locale));
    // The token that IS this signature. The section already names the account
    // and the mint transaction; without this the reader had no way to go from
    // the page to the piece of evidence itself. The collection's ledger name
    // rides above the address so it can be read by a human.
    const nft = signatureNftOf(envelope, s);
    if (nft) {
      cur.field(L.signatureNft, nft, {
        mono: true,
        lead: opts.nftNames?.[nftResource(nft)],
      });
    }
    // The transaction that recorded THIS signature on the ledger: the one
    // thing a reader can open and check for themselves.
    if (s.transactionIntentHash) {
      cur.field(L.signatureTx, s.transactionIntentHash, {
        mono: true,
        link: txLink(s.transactionIntentHash),
        color: txLink(s.transactionIntentHash) ? accentInk : undefined,
      });
    }
    if (i < envelope.signatures.length - 1) {
      cur.rule();
      cur.gap(6);
    }
  });

  // ── Still pending (multi-party, not yet complete) ──
  if (pending.length > 0) {
    cur.sectionTitle(`${L.pendingSection} (${pending.length})`);
    cur.text(L.pendingNote, { size: 8, color: MUTED });
    cur.gap(5);
    pending.forEach((account) => {
      cur.text(`•  ${account}`, { size: 9, color: MUTED });
      cur.gap(2);
    });
    cur.gap(4);
  } else if (roster.length > 1) {
    cur.text(L.complete, { size: 9, bold: true, color: accentInk });
    cur.gap(6);
  }

  // ── On-ledger anchor (optional) ──
  // Both on-ledger shapes belong here: a stand-alone anchor (`onChain`) and a
  // multi-party signing request (`request`). Only the first was printed, so an
  // on-ledger multi-party signature showed nothing at all about the ledger.
  if (anchored) {
    cur.sectionTitle(L.anchorSection);
    let linked = false;
    if (envelope.onChain) {
      const url = txLink(envelope.onChain.transactionIntentHash);
      cur.field(L.anchorResource, envelope.onChain.resourceAddress, { mono: true });
      cur.field(L.anchorTx, envelope.onChain.transactionIntentHash, {
        mono: true,
        link: url,
        color: url ? accentInk : undefined,
      });
      linked ||= !!url;
    }
    if (envelope.request) {
      cur.field(L.anchorRequest, envelope.request.requestId, { mono: true });
      const url = txLink(envelope.request.transactionIntentHash);
      if (envelope.request.transactionIntentHash) {
        cur.field(L.anchorRequestTx, envelope.request.transactionIntentHash, {
          mono: true,
          link: url,
          color: url ? accentInk : undefined,
        });
        linked ||= !!url;
      }
    }
    // Only claimed when something on the page actually IS a link.
    if (linked || envelope.signatures.some((s) => txLink(s.transactionIntentHash))) {
      cur.text(L.txLinkNote, { size: 7.5, color: MUTED });
      cur.gap(2);
    }
    cur.text(L.anchorNote, { size: 7.5, color: MUTED });
    cur.gap(4);
  }

  // ── Certificate signatures (PAdES / X.509), one entry per signer ──
  // Read from the envelope, so every signer's certificate stays on the record
  // even after a co-signer regenerates the PDF from the original.
  const certified = envelope.signatures.filter((s) => s.certificate);
  if (certified.length > 0) {
    cur.sectionTitle(L.certSection);
    certified.forEach((s, i) => {
      const c = s.certificate!;
      // With several certificates, say whose each one is.
      if (certified.length > 1) {
        cur.text(signerLabel(s), { size: 10.5, bold: true });
        cur.gap(4);
      }
      cur.field(L.certSubject, c.subjectCN || '—');
      if (c.subjectO) cur.field(L.certOrg, c.subjectO);
      if (c.issuer) cur.field(L.certIssuer, c.issuer);
      cur.field(
        L.certValidity,
        `${fmtDate(c.validFrom, locale)} — ${fmtDate(c.validTo, locale)}`,
      );
      if (c.serialNumber) cur.field(L.certSerial, c.serialNumber, { mono: true });
      if (i < certified.length - 1) {
        cur.rule();
        cur.gap(6);
      }
    });
    if (opts.padesSigned) {
      cur.text(L.certNote, { size: 7.5, color: MUTED });
      cur.gap(4);
    }
  }

  // ── Verify box (QR + instruction) ──
  cur.sectionTitle(L.verifyTitle);
  const qrSize = 96;
  cur.ensure(qrSize + 8);
  let qrDrawn = false;
  try {
    const QRCode = (await import('qrcode')).default;
    const dataUrl = await QRCode.toDataURL(opts.verifyUrl, {
      width: qrSize * 3,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    const img = await pdfDoc.embedPng(base64PngToBytes(dataUrl) as Uint8Array<ArrayBuffer>);
    cur.page.drawImage(img, {
      x: MARGIN,
      y: cur.y - qrSize,
      width: qrSize,
      height: qrSize,
    });
    qrDrawn = true;
  } catch {
    // No QR — the URL text below still lets anyone verify.
  }
  const textX = qrDrawn ? MARGIN + qrSize + 16 : MARGIN;
  const textW = PAGE_W - MARGIN - textX;
  const savedY = cur.y;
  // The ledger sentence belongs to certificates that HAVE a ledger side.
  // Printing it on a purely off-ledger signature promised a public record that
  // was never written, on the very page a reader trusts to be exact.
  cur.text(
    anchored ? `${L.verifyInstruction} ${L.verifyInstructionLedger}` : L.verifyInstruction,
    { x: textX, maxWidth: textW, size: 9.5 },
  );
  cur.gap(3);
  // Clickable, every line of it. The address is long (it carries the request,
  // so the check runs on arrival) and wraps over two or three lines, which is
  // exactly where copying it by hand goes wrong: half a URL opens nothing.
  cur.text(opts.verifyUrl, {
    x: textX,
    maxWidth: textW,
    size: 9,
    color: accentInk,
    link: opts.verifyUrl,
  });
  // Keep the cursor below the taller of the QR / text column.
  cur.y = Math.min(cur.y, savedY - qrSize);
  cur.gap(10);

  // ── Honest disclaimer + footer ──
  cur.rule();
  cur.gap(6);
  cur.text(L.disclaimerTitle, { size: 8, bold: true, color: MUTED });
  cur.gap(2);
  cur.text(anchored ? `${L.disclaimer} ${L.disclaimerAnchored}` : L.disclaimer, {
    size: 8,
    color: MUTED,
  });
  cur.gap(6);
  // This is when the PAGE was printed, which is neither a signing date nor
  // anything the ledger knows about — and a bare date next to a signature gets
  // read as one, so it says what it is.
  cur.text(
    `${L.generated} ${fmtDate(new Date().toISOString(), locale)} · ${L.generatedNote}`,
    { size: 7.5, color: MUTED },
  );
}
