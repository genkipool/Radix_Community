/**
 * Single source of truth for the Radix Seal artwork.
 *
 * The seal is used in two places that used to hold divergent copies:
 *  - the on-ledger / watermark asset `public/SVGs/radix-seal.svg` (a real file
 *    fetched by wallets and rasterised by third parties, so it needs a fixed
 *    ink, a real intrinsic size and its own opaque backing disc);
 *  - the theme-aware inline mark on the Radix Seal website (`RadixSealMark`),
 *    which draws with `currentColor` on the page's own surface, so it adapts
 *    to light/dark and needs no backing.
 *
 * The two used to diverge in a third way too: the file carried a letterpress
 * emboss (`feDropShadow`) that the website mark never had. It is gone. A soft
 * white shadow only works on white, eroded the thin strokes at thumbnail size,
 * and `feDropShadow` is not something every SVG rasteriser in the chain
 * supports. What is left is flat geometry that every renderer agrees on.
 *
 * Both now derive from THIS function — the geometry lives in exactly one place.
 * The checked-in `.svg` file is generated from `radixSealSvg({ ink: SEAL_INK,
 * plate: SEAL_PLATE, lettersAsPaths: true, fluid: false })` and a test guards
 * against drift (see the seal-svg test).
 * Regenerate the file with: `pnpm gen:seal-svg`.
 */

/** Brand ink used by the standalone file. */
export const SEAL_INK = '#132245';

/**
 * Opaque backing disc of the standalone asset. The file is shown over
 * backgrounds nobody here controls — a wallet NFT card (light OR dark theme)
 * and the coloured header band of the PDF signature certificate — where a
 * transparent navy-on-nothing mark was all but invisible. Painting the seal on
 * its own paper disc makes it read identically everywhere, which is the point:
 * it is a seal, not a glyph.
 */
export const SEAL_PLATE = '#ffffff';

const FONT_STACK =
  "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * The RADIX / SEAL letters as pre-traced outlines: Montserrat SemiBold (600)
 * glyphs at the exact `<tspan>` anchor points and font sizes of the text
 * variant below (rows y=355 size 54 and y=405 size 26, each letter centered
 * on its x). Wallet NFT renderers (e.g. AndroidSVG behind Coil in the Radix
 * Android wallet) ship no Montserrat and have unreliable `<text>` support, so
 * the on-ledger asset embeds the letters as geometry instead of relying on
 * any font. Traced with fontTools from `Montserrat[wght].ttf` at wght=600;
 * retrace only if the lettering itself (font, sizes or positions) changes.
 */
const LETTER_PATHS: readonly string[] = [
  'M111.4 355V317.2H126.8Q134.4 317.2 138.7 320.8Q143 324.4 143 330.7Q143 334.8 141 337.8Q139.1 340.8 135.5 342.4Q131.9 344 126.9 344H115.2L118.4 340.8V355ZM136.1 355 126.5 341.3H134L143.6 355ZM118.4 341.6 115.2 338.2H126.6Q131.2 338.2 133.6 336.2Q135.9 334.2 135.9 330.7Q135.9 327.1 133.6 325.1Q131.2 323.1 126.6 323.1H115.2L118.4 319.7Z',
  'M167.5 355 184.5 317.2H191.4L208.5 355H201.1L186.5 320.9H189.3L174.7 355ZM175.4 346.2 177.2 340.7H197.6L199.6 346.2Z',
  'M232.8 355V317.2H249.3Q255.4 317.2 260.1 319.6Q264.7 321.9 267.3 326.2Q269.9 330.4 269.9 336.1Q269.9 341.8 267.3 346Q264.7 350.3 260.1 352.6Q255.4 355 249.3 355ZM239.8 349.1H249Q253.2 349.1 256.3 347.4Q259.4 345.8 261.1 342.9Q262.9 340 262.9 336.1Q262.9 332.1 261.1 329.3Q259.4 326.4 256.3 324.8Q253.2 323.1 249 323.1H239.8Z',
  'M308.5 355V317.2H315.5V355Z',
  'M355.8 355 371.7 333.1 371.7 338.3 356.5 317.2H364.5L375.8 332.8L372.5 332.9L383.7 317.2H391.3L376.2 338V332.9L392.3 355H384.2L372.3 338.4L375.5 338.4L363.8 355Z',
  'M174.9 405.3Q172.8 405.3 170.8 404.6Q168.9 404 167.7 403.1L168.9 400.5Q170 401.3 171.6 401.9Q173.2 402.5 174.9 402.5Q176.3 402.5 177.2 402.1Q178.1 401.8 178.5 401.3Q178.9 400.8 178.9 400.1Q178.9 399.3 178.3 398.8Q177.8 398.3 176.8 397.9Q175.8 397.6 174.7 397.4Q173.5 397.1 172.4 396.8Q171.2 396.4 170.3 395.9Q169.3 395.3 168.7 394.4Q168.1 393.4 168.1 392Q168.1 390.5 168.9 389.3Q169.7 388 171.3 387.3Q173 386.5 175.4 386.5Q177.1 386.5 178.7 387Q180.3 387.4 181.5 388.2L180.4 390.8Q179.2 390 177.9 389.7Q176.6 389.3 175.4 389.3Q174 389.3 173.2 389.7Q172.3 390 171.9 390.6Q171.5 391.1 171.5 391.8Q171.5 392.7 172.1 393.2Q172.7 393.7 173.6 393.9Q174.6 394.2 175.7 394.5Q176.9 394.8 178 395.1Q179.2 395.5 180.1 396Q181.1 396.6 181.7 397.5Q182.3 398.4 182.3 399.8Q182.3 401.3 181.5 402.5Q180.7 403.8 179 404.5Q177.4 405.3 174.9 405.3Z',
  'M218.7 405V386.8H232V389.6H222.1V402.2H232.4V405ZM221.8 397.1V394.4H230.9V397.1Z',
  'M265.1 405 273.3 386.8H276.7L284.9 405H281.3L274.3 388.6H275.6L268.6 405ZM268.9 400.8 269.8 398.1H279.6L280.6 400.8Z',
  'M319.7 405V386.8H323V402.1H332.5V405Z',
];

export interface SealSvgOptions {
  /** Fill/stroke colour: the brand ink for the file, `currentColor` inline. */
  ink?: string;
  /**
   * Opaque disc painted behind the mark (see `SEAL_PLATE`). Set for the
   * standalone asset, whose background is out of our hands; left off for the
   * inline mark, which sits on the site's own theme-aware surface.
   */
  plate?: string | null;
  /**
   * Emit the RADIX / SEAL lettering as pre-traced Montserrat outlines instead
   * of `<text>`. On for the standalone/on-ledger file so wallets without the
   * font (or without text support) still show the letters; off for the inline
   * mark, where the browser has the real font and text stays crisp/selectable.
   */
  lettersAsPaths?: boolean;
  /**
   * Size the SVG to its container (`width="100%"`), which is what the inline
   * mark needs. The standalone file sets `false` so it declares a real
   * intrinsic size instead: rasterisers outside the browser (the Radix image
   * service that renders every NFT thumbnail, `<img>` → canvas in the PDF
   * pipeline, AndroidSVG in the wallet's fallback decoder) resolve `100%`
   * against nothing and fall back to their own default box, which is not even
   * square.
   */
  fluid?: boolean;
}

/** The artwork's coordinate system; also the file's intrinsic size in px. */
const VIEWBOX = 500;

/** Full, self-contained SVG markup for the Radix Seal. */
export function radixSealSvg({
  ink = SEAL_INK,
  plate = null,
  lettersAsPaths = false,
  fluid = true,
}: SealSvgOptions = {}): string {
  const size = fluid ? '100%' : String(VIEWBOX);
  const backing = plate
    ? `\n  <circle cx="250" cy="250" r="238" fill="${plate}"/>`
    : '';
  const lettering = lettersAsPaths
    ? LETTER_PATHS.map((d) => `      <path d="${d}" fill="${ink}"/>`).join('\n')
    : `      <text y="355" font-family="${FONT_STACK}" font-size="54" font-weight="600" letter-spacing="2" fill="${ink}" text-anchor="middle"><tspan x="126">R</tspan><tspan x="188">A</tspan><tspan x="250">D</tspan><tspan x="312">I</tspan><tspan x="374">X</tspan></text>
      <text y="405" font-family="${FONT_STACK}" font-size="26" font-weight="600" letter-spacing="4" fill="${ink}" text-anchor="middle"><tspan x="175">S</tspan><tspan x="225">E</tspan><tspan x="275">A</tspan><tspan x="325">L</tspan></text>`;

  // Hairlines (inner ring, divider rules) are deliberately heavier than a
  // "true" hairline: the seal is read at 112 px in a wallet list and at 44 pt
  // in the PDF header, and anything thinner simply disappears at that scale.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="${size}" height="${size}">${backing}
  <g>
    <circle cx="250" cy="250" r="215" fill="none" stroke="${ink}" stroke-width="12"/>
    <circle cx="250" cy="250" r="198" fill="none" stroke="${ink}" stroke-width="4"/>
    <g transform="translate(0,5)">
      <g transform="translate(160.4, 125) scale(0.8)">
        <path d="M0,91.1 L27.35,91.1 L82.85,168.1 L156.45,0 L223.9,0" fill="none" stroke="${ink}" stroke-width="18.75" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <line x1="150" y1="290" x2="232" y2="290" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>
      <line x1="268" y1="290" x2="350" y2="290" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>
      <polygon points="250,284 256,290 250,296 244,290" fill="${ink}"/>
${lettering}
    </g>
  </g>
</svg>
`;
}
