/**
 * Single source of truth for the Radix Seal artwork.
 *
 * The seal is used in two places that used to hold divergent copies:
 *  - the on-ledger / watermark asset `public/SVGs/radix-seal.svg` (a real file
 *    fetched by wallets, so it needs a fixed colour and the letterpress emboss);
 *  - the theme-aware inline mark on the Radix Seal website (`RadixSealMark`),
 *    which draws with `currentColor` and no emboss so it adapts to light/dark.
 *
 * Both now derive from THIS function — the geometry lives in exactly one place.
 * The checked-in `.svg` file is generated from `radixSealSvg({ ink: '#132245',
 * emboss: true })` and a test guards against drift (see the seal-svg test).
 * Regenerate the file with: `npm run gen:seal-svg`.
 */

/** Brand ink used by the standalone file. */
export const SEAL_INK = '#132245';

const FONT_STACK =
  "'Montserrat', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface SealSvgOptions {
  /** Fill/stroke colour: the brand ink for the file, `currentColor` inline. */
  ink?: string;
  /**
   * Letterpress emboss (drop shadows that assume a LIGHT background). On for
   * the standalone file/watermark; off for the theme-aware inline mark, where
   * a light shadow would clash with a dark theme.
   */
  emboss?: boolean;
}

/** Full, self-contained SVG markup for the Radix Seal. */
export function radixSealSvg({
  ink = SEAL_INK,
  emboss = true,
}: SealSvgOptions = {}): string {
  const defs = emboss
    ? `
  <defs>
    <filter id="stamped" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="-0.5" dy="-1" stdDeviation="0.5" flood-color="#000000" flood-opacity="0.3" result="shadow1"/>
      <feDropShadow dx="1.5" dy="1.5" stdDeviation="1" flood-color="#ffffff" flood-opacity="0.8" in="shadow1" result="shadow2"/>
    </filter>
  </defs>`
    : '';
  const filterAttr = emboss ? ' filter="url(#stamped)"' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">${defs}
  <g${filterAttr}>
    <circle cx="250" cy="250" r="215" fill="none" stroke="${ink}" stroke-width="12"/>
    <circle cx="250" cy="250" r="198" fill="none" stroke="${ink}" stroke-width="3"/>
    <g transform="translate(0,5)">
      <g transform="translate(160.4, 125) scale(0.8)">
        <path d="M0,91.1 L27.35,91.1 L82.85,168.1 L156.45,0 L223.9,0" fill="none" stroke="${ink}" stroke-width="18.75" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <line x1="150" y1="290" x2="232" y2="290" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="268" y1="290" x2="350" y2="290" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="250,284 256,290 250,296 244,290" fill="${ink}"/>
      <text y="355" font-family="${FONT_STACK}" font-size="54" font-weight="600" letter-spacing="2" fill="${ink}" text-anchor="middle"><tspan x="126">R</tspan><tspan x="188">A</tspan><tspan x="250">D</tspan><tspan x="312">I</tspan><tspan x="374">X</tspan></text>
      <text y="405" font-family="${FONT_STACK}" font-size="26" font-weight="600" letter-spacing="4" fill="${ink}" text-anchor="middle"><tspan x="175">S</tspan><tspan x="225">E</tspan><tspan x="275">A</tspan><tspan x="325">L</tspan></text>
    </g>
  </g>
</svg>
`;
}
