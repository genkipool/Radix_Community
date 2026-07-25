/**
 * Visual watermark stamped across every page of a PDF (pdf-lib). This is a
 * presentation layer only — it changes the delivered PDF's bytes, which is why
 * the original document is embedded separately for verification (see
 * pdf-embed.ts). Loaded lazily like the rest of the PDF tooling.
 */
export type WatermarkKind = 'none' | 'own' | 'seal';

export interface WatermarkOptions {
  kind: WatermarkKind;
  /** Text for `own` watermarks. */
  text?: string;
  /** Image URL for `own` (custom) or `seal` (brand) watermarks. */
  imageUrl?: string;
}

const SEAL_TEXT = 'RADIX SEAL';

/**
 * Decodes a base64 `data:` URL to bytes WITHOUT fetching it. A picked image
 * arrives as a data URL, and the app's CSP `connect-src` does not allow `data:`
 * — so `fetch()` on it is blocked in the browser and the user's PNG/JPG
 * watermark silently never appeared. Decoding locally sidesteps the network
 * entirely (and is faster).
 */
function dataUrlToBytes(url: string): Uint8Array | null {
  const comma = url.indexOf(',');
  if (comma < 0) return null;
  const meta = url.slice(0, comma);
  const body = url.slice(comma + 1);
  try {
    if (!meta.includes(';base64')) {
      // Rare, but a data URL may be percent-encoded rather than base64.
      const decoded = decodeURIComponent(body);
      const out = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i += 1) out[i] = decoded.charCodeAt(i);
      return out;
    }
    const binary = atob(body);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  if (url.startsWith('data:')) return dataUrlToBytes(url);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Rasterizes an SVG (same-origin URL or data URI) to PNG bytes via a canvas —
 * pdf-lib can only embed PNG/JPG. Browser-only; null on any failure. Exported
 * so the visible signature page can embed the seal logo too.
 */
export async function svgUrlToPngBytes(
  url: string,
  targetSize = 1000,
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null;
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg_load_failed'));
      img.src = url;
    });
    const w = img.naturalWidth || targetSize;
    const h = img.naturalHeight || targetSize;
    const scale = targetSize / Math.max(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Returns watermarked PDF bytes, or the input unchanged when `kind === 'none'`
 * or the watermark can't be produced (never throws — watermarking is optional).
 */
export async function applyWatermark(
  pdfBytes: Uint8Array,
  options: WatermarkOptions,
): Promise<Uint8Array> {
  if (options.kind === 'none') return pdfBytes;

  try {
    const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
    const pages = pdfDoc.getPages();

    // Prefer an image watermark when a URL is given (seal default or custom).
    const imageUrl =
      options.imageUrl ||
      (options.kind === 'seal' ? '/SVGs/radix-seal.svg' : undefined);
    let embeddedImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    if (imageUrl) {
      const isSvg =
        imageUrl.toLowerCase().endsWith('.svg') ||
        imageUrl.startsWith('data:image/svg');
      const bytes = isSvg
        ? await svgUrlToPngBytes(imageUrl)
        : await fetchImageBytes(imageUrl);
      if (bytes) {
        // JPEGs may arrive as data URLs (in-browser picks), not .jpg paths.
        const lower = imageUrl.toLowerCase();
        const isJpg =
          /\.jpe?g($|\?)/.test(lower) || lower.startsWith('data:image/jpeg');
        embeddedImage = isJpg
          ? await pdfDoc.embedJpg(bytes).catch(() => null)
          : await pdfDoc.embedPng(bytes).catch(() => null);
      }
    }

    const text =
      options.kind === 'seal' ? SEAL_TEXT : (options.text || '').trim();
    const font = embeddedImage
      ? null
      : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    if (!embeddedImage && !text) return pdfBytes;

    for (const page of pages) {
      const { width, height } = page.getSize();
      if (embeddedImage) {
        const scale = Math.min(width, height) * 0.5;
        const dims = embeddedImage.scaleToFit(scale, scale);
        page.drawImage(embeddedImage, {
          x: (width - dims.width) / 2,
          y: (height - dims.height) / 2,
          width: dims.width,
          height: dims.height,
          opacity: 0.08,
        });
      } else if (font) {
        const size = Math.min(width, height) / Math.max(text.length, 6) * 1.6;
        page.drawText(text, {
          x: width * 0.12,
          y: height * 0.35,
          size,
          font,
          color: rgb(0.08, 0.13, 0.27),
          rotate: degrees(45),
          opacity: 0.1,
        });
      }
    }
    return pdfDoc.save();
  } catch {
    return pdfBytes;
  }
}
