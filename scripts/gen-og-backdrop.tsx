/**
 * Regenerates `lib/generated/og-backdrop.ts`, the artwork behind every social
 * share card, from the console sidebar graphic itself.
 *
 * Run with `pnpm gen:og-backdrop` whenever `SidebarGraphic` changes.
 *
 * Why a build step and not a render at request time: the app router refuses to
 * import `react-dom/server`, and transcribing 690 lines of nodes, links and
 * glass panels by hand would have been a copy that went stale the first time
 * the original was touched. Generating from the real component keeps one source
 * of truth with an explicit regeneration step, exactly as `gen:seal-svg` does.
 *
 * Two things are resolved on the way out, because a card is rasterised with no
 * browser and no stylesheet:
 *
 *   theme tokens   the SVG paints with `var(--sidebar-*)`, which nothing would
 *                  resolve, so `radix-dark` values are substituted literally
 *   aspect         the graphic is drawn 1200x560 and a card is 1200x630. The
 *                  crop is expressed as a narrowed viewBox rather than through
 *                  `preserveAspectRatio`, which the rasteriser ignored: it
 *                  stretched the drawing to fill instead, and the seal came out
 *                  302 wide by 376 tall where it should have been round
 *
 * Its own headline is left empty: the card lays type out in satori, which
 * wraps, clamps and has the fonts, none of which SVG text does.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SidebarGraphic } from '../components/ui/SidebarGraphic';
import { ThemeProvider } from '../context/ThemeContext';
import { radixSealSvg } from '../features/seal/lib/radix-seal-svg';

const WIDTH = 1200;
const HEIGHT = 630;

/** The graphic's own canvas, as `SidebarGraphic` draws it. */
const DRAWN_WIDTH = 1200;
const DRAWN_HEIGHT = 560;

/** Window on that canvas with the card's proportions, centred. */
const CROP_W = Math.round(DRAWN_HEIGHT * (WIDTH / HEIGHT));
const CROP_X = Math.round((DRAWN_WIDTH - CROP_W) / 2);

/** `radix-dark` values of every token the graphic paints with. */
const DARK_TOKENS: Record<string, string> = {
  'sidebar-bg': '#040920',
  'sidebar-primary': '#3B9BFF',
  'sidebar-secondary': '#2BDFAA',
  'sidebar-text-main': '#ffffff',
  'sidebar-grad1': '#00E5A0',
  'sidebar-grad-mid': '#1B3FCC',
  'sidebar-grad2': '#d829aa',
  'sidebar-shadow': '#000105',
  'sidebar-shadow2': '#01020a',
  'sidebar-glow-op-1': '0.5',
  'sidebar-glow-op-2': '0.55',
  'sidebar-glow-op-3': '0.18',
  'sidebar-net-primary': '#3B9BFF',
  'sidebar-net-secondary': '#2BDFAA',
  'sidebar-net-thick': '#ffffff',
  'sidebar-node-fill': '#ffffff',
  'sidebar-net-opacity': '0.85',
  'sidebar-layer-shadow': '#020518',
  'sidebar-comm-lines': 'rgba(255,255,255,0.12)',
  'sidebar-card-base': '#000105',
  'sidebar-card-stroke': '#000000',
  'sidebar-card-mid-stroke': 'rgba(0,0,0,0.6)',
  // Both follow the theme's own pair, as declared in theme-radix.css.
  'sidebar-atom-rings': '#3B9BFF', // var(--sidebar-primary)
  'sidebar-check-glow': '#2BDFAA', // var(--sidebar-secondary)
};

const markup = renderToStaticMarkup(
  <ThemeProvider initialTheme="radix-dark">
    <SidebarGraphic appName="" title="" subtitle="" variant="default" />
  </ThemeProvider>,
);

const unresolved = new Set<string>();
const svg = markup
  .replace(/var\(--([a-z0-9-]+)\)/g, (whole, token: string) => {
    if (DARK_TOKENS[token]) return DARK_TOKENS[token];
    unresolved.add(token);
    return whole;
  })
  // Crop, not squash. Keeping the full 560 of height and narrowing the window
  // to 560 * (WIDTH / HEIGHT) gives the card's own proportions, so the scale
  // that follows is the same on both axes and a circle stays a circle.
  .replace(/viewBox="[^"]*"/, `viewBox="${CROP_X} 0 ${CROP_W} ${DRAWN_HEIGHT}"`)
  .replace(/<svg /, `<svg width="${WIDTH}" height="${HEIGHT}" `);

if (unresolved.size > 0) {
  console.error(`Unresolved theme tokens: ${[...unresolved].join(', ')}`);
  process.exit(1);
}

/**
 * Pulls out a whole `<g>` by its opening tag, counting nested groups so the
 * matching close is found rather than the first one.
 */
function cutGroup(source: string, openTag: string): { before: string; after: string } {
  const start = source.indexOf(openTag);
  if (start < 0) throw new Error(`Group not found: ${openTag}`);

  let depth = 0;
  let i = start;
  while (i < source.length) {
    if (source.startsWith('<g', i)) depth += 1;
    else if (source.startsWith('</g>', i)) {
      depth -= 1;
      if (depth === 0) return { before: source.slice(0, start), after: source.slice(i + 4) };
    }
    i += 1;
  }
  throw new Error(`Unbalanced group: ${openTag}`);
}

/**
 * The app tile the drawing puts on the right, swapped for the Radix Seal.
 *
 * The seal is inked with a gradient rather than a flat colour so it belongs to
 * the same palette as everything else on the card: the sidebar's primary into
 * its secondary, the same run the headline uses. Its plate is dropped, since a
 * white disc on this backdrop would read as a hole.
 *
 * Placed where the tile was. The tile sits at (960, 270) and spans about 246
 * units; the seal is drawn on a 500 grid, so 0.62 puts it at a matching size,
 * offset by half of that to keep the same centre.
 */
const TILE_OPEN = '<g transform="translate(960, 270) rotate(14) skewX(-12) scale(0.85, 0.81)">';

function withSealMark(source: string): string {
  const seal = radixSealSvg({
    ink: 'url(#ogSealInk)',
    lettersAsPaths: true,
    fluid: false,
  })
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');

  const { before, after } = cutGroup(source, TILE_OPEN);
  const defs =
    `<defs>` +
    `<linearGradient id="ogSealInk" x1="0%" y1="0%" x2="100%" y2="100%">` +
    `<stop offset="0%" stop-color="${DARK_TOKENS['sidebar-primary']}"/>` +
    `<stop offset="100%" stop-color="${DARK_TOKENS['sidebar-secondary']}"/>` +
    `</linearGradient>` +
    // Room to spare on every side, or the blur is clipped square.
    `<filter id="ogSealShadow" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="${DARK_TOKENS['sidebar-shadow']}" flood-opacity="0.9"/>` +
    `</filter>` +
    `</defs>`;

  return (
    `${before}${defs}` +
    `<g transform="translate(805, 115) scale(0.62)" filter="url(#ogSealShadow)">${seal}</g>` +
    `${after}`
  );
}

const uri = (markup: string) =>
  `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;

const sealSvg = withSealMark(svg);

const target = resolve(process.cwd(), 'lib/generated/og-backdrop.ts');
writeFileSync(
  target,
  `// GENERATED by \`pnpm gen:og-backdrop\` from components/ui/SidebarGraphic.
// Do not edit: change the component and regenerate.
export const OG_BACKDROP_BASE = '${DARK_TOKENS['sidebar-bg']}';

/** The drawing as the sidebar has it, app tile and all. */
export const OG_BACKDROP_DATA_URI =
  '${uri(svg)}';

/** The same drawing with the Radix Seal in place of that tile. */
export const OG_BACKDROP_SEAL_DATA_URI =
  '${uri(sealSvg)}';
`,
);
console.log(
  `Wrote ${target} (${(svg.length / 1024).toFixed(1)} KB + ${(sealSvg.length / 1024).toFixed(1)} KB of SVG)`,
);
