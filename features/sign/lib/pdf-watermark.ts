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

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
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
      (options.kind === 'seal' ? '/seal/radix-seal.svg' : undefined);
    let embeddedImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    if (imageUrl && !imageUrl.endsWith('.svg')) {
      const bytes = await fetchImageBytes(imageUrl);
      if (bytes) {
        embeddedImage = imageUrl.toLowerCase().match(/\.jpe?g$/)
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
