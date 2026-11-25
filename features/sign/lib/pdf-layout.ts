/**
 * Shared A4 portrait PDF layout primitives (`pdf-lib`).
 *
 * Used by both the per-document signature certificate page
 * (`pdf-signature-page.ts`) and the institutional collection audit report
 * (`audit-pdf.ts`), so branding, typography, wrapping, image embedding, link
 * annotations, and pagination behave identically everywhere.
 */
import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from 'pdf-lib';
import { pdfSafeText } from './pdf-text';
import { fetchImageBytes, svgUrlToPngBytes } from './pdf-watermark';

/** An RGB triple in the 0..1 range that pdf-lib's colours use. */
export type Rgb01 = [number, number, number];

/** pdf-lib's `rgb(r,g,b)` helper, injected so the Cursor stays synchronous. */
export type RgbFn = (r: number, g: number, b: number) => RGB;

/**
 * Registers a clickable URI annotation over a rectangle of a page, injected for
 * the same reason as `RgbFn` (pdf-lib is imported dynamically).
 */
export type LinkFn = (
  page: PDFPage,
  rect: [number, number, number, number],
  url: string,
) => void;

// ─── Layout constants (A4 portrait, points) ──────────────────────────────────

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 54;
export const CONTENT_W = PAGE_W - MARGIN * 2;

export const SEAL_LOGO_SIZE = 44;
export const SEAL_LOGO_RASTER = 512;

export const INK: Rgb01 = [0.11, 0.13, 0.2];
export const MUTED: Rgb01 = [0.42, 0.45, 0.55];
/** Default accent (indigo) when the theme's brand colour can't be read. */
export const ACCENT: Rgb01 = [0.29, 0.33, 0.92];
export const LINE: Rgb01 = [0.86, 0.88, 0.93];
export const WHITE: Rgb01 = [1, 1, 1];
export const SURFACE_TINT: Rgb01 = [0.96, 0.97, 0.99];
export const WARNING_INK: Rgb01 = [0.68, 0.34, 0.03];
export const WARNING_BG: Rgb01 = [0.99, 0.96, 0.9];
export const DANGER_INK: Rgb01 = [0.76, 0.14, 0.14];

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
export function luminance([r, g, b]: Rgb01): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Darkens a colour just enough to stay readable as text on a white page. */
export function readableOnWhite(c: Rgb01): Rgb01 {
  const l = luminance(c);
  if (l <= 0.45) return c;
  const f = 0.45 / l;
  return [c[0] * f, c[1] * f, c[2] * f];
}

/**
 * Reads the active theme's brand colour (`--color-primary`) as a 0..1 RGB
 * triple, for tinting reports/certificates. Undefined outside the browser or
 * when the value can't be parsed, so the renderer falls back to its default accent.
 */
export function readBrandAccent(): Rgb01 | undefined {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
    return undefined;
  }
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary')
      .trim();
    return parseColor(value) ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── Small helpers ────────────────────────────────────────────────────────────

/** Wraps text to `maxWidth`, breaking over-long tokens (hashes, addresses). */
export function wrapLines(
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

export function base64PngToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Loads a (possibly cross-origin) image URL into a pdf-lib image. SVGs are
 * rasterised via canvas; PNG/JPG bytes are fetched directly. Best-effort: any
 * CORS/parse failure returns null so the logo is simply omitted.
 */
export async function embedRemoteImage(
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

/** Builds a bare (border-less) URI link registrar for a `PDFDocument`. */
export async function createPdfLinkFn(pdfDoc: PDFDocument): Promise<LinkFn> {
  const { PDFName, PDFString } = await import('pdf-lib');
  return (page, rect, url) => {
    const ref = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: rect,
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
      }),
    );
    const annots = page.node.Annots();
    if (annots) annots.push(ref);
    else page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([ref]));
  };
}

// ─── Top-down A4 cursor ──────────────────────────────────────────────────────

/**
 * Top-down cursor over one or more A4 pages. Adds a fresh page when content
 * runs past the bottom margin, keeping multi-page PDFs cleanly paginated.
 */
export class PdfCursor {
  page: PDFPage;
  y: number;
  pages: PDFPage[];
  bottomMargin: number;

  constructor(
    private doc: PDFDocument,
    public fonts: { regular: PDFFont; bold: PDFFont },
    public rgbFn: RgbFn,
    /** Accent already darkened to stay readable on the white page. */
    public accentInk: Rgb01,
    public linkFn: LinkFn,
    bottomMargin = MARGIN,
  ) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.pages = [this.page];
    this.y = PAGE_H - MARGIN;
    this.bottomMargin = bottomMargin;
  }

  rgb(c: Rgb01): RGB {
    return this.rgbFn(c[0], c[1], c[2]);
  }

  ensure(space: number) {
    if (this.y - space < this.bottomMargin) {
      this.page = this.doc.addPage([PAGE_W, PAGE_H]);
      this.pages.push(this.page);
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
      color?: Rgb01;
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

/** Draws the branded top header band shared by Radix Seal PDF deliverables. */
export async function drawBrandedHeaderBand(
  pdfDoc: PDFDocument,
  cur: PdfCursor,
  opts: {
    title: string;
    tagline: string;
    sealImageUrl?: string;
    accent?: Rgb01;
  },
): Promise<{ accentInk: Rgb01; bandY: number }> {
  const accent: Rgb01 = opts.accent ?? ACCENT;
  const accentInk = readableOnWhite(accent);
  const lightBand = luminance(accent) > 0.6;
  const bandText: Rgb01 = lightBand ? INK : WHITE;
  const bandSubText: Rgb01 = lightBand ? MUTED : [0.9, 0.91, 0.98];

  const bandH = 74;
  const bandY = PAGE_H - bandH;
  cur.page.drawRectangle({
    x: 0,
    y: bandY,
    width: PAGE_W,
    height: bandH,
    color: cur.rgb(accent),
  });

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
      // No logo — title alone is fine.
    }
  }
  cur.page.drawText(pdfSafeText(opts.title, 120), {
    x: logoRight,
    y: bandY + bandH - 34,
    size: 19,
    font: cur.fonts.bold,
    color: cur.rgb(bandText),
  });
  cur.page.drawText(pdfSafeText(opts.tagline, 160), {
    x: logoRight,
    y: bandY + bandH - 52,
    size: 9,
    font: cur.fonts.regular,
    color: cur.rgb(bandSubText),
  });
  cur.y = bandY - 22;
  return { accentInk, bandY };
}
