import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  radixSealSvg,
  SEAL_INK,
  SEAL_PLATE,
} from '@/features/seal/lib/radix-seal-svg';

/**
 * The Radix Seal artwork has a single source of truth (`radixSealSvg`). The
 * standalone file and the website's inline mark both derive from it, so they
 * can never drift. This guards the checked-in file against manual edits: if the
 * geometry changes, regenerate it with `pnpm gen:seal-svg`.
 */
describe('Radix Seal SVG single source', () => {
  it('the checked-in public/SVGs/radix-seal.svg matches the generator', () => {
    const onDisk = readFileSync(
      resolve(process.cwd(), 'public/SVGs/radix-seal.svg'),
      'utf8',
    );
    expect(onDisk).toBe(
      radixSealSvg({
        ink: SEAL_INK,
        plate: SEAL_PLATE,
        lettersAsPaths: true,
        fluid: false,
      }),
    );
    // The on-ledger asset must not depend on fonts: wallet renderers (e.g.
    // AndroidSVG behind Coil) ship no Montserrat and may not draw <text>.
    expect(onDisk).not.toContain('<text');
  });

  it('the asset survives being rendered by someone else', () => {
    const asset = radixSealSvg({
      ink: SEAL_INK,
      plate: SEAL_PLATE,
      lettersAsPaths: true,
      fluid: false,
    });
    // A real intrinsic size: the Radix image service, canvas rasterisation in
    // the PDF pipeline and AndroidSVG all need one — `100%` gives them nothing
    // to resolve against and they fall back to a non-square default box.
    expect(asset).toContain('width="500" height="500"');
    expect(asset).not.toContain('100%');
    // Its own opaque disc, so it reads on a dark wallet card and on the
    // coloured header band of the PDF certificate alike.
    expect(asset).toContain(`<circle cx="250" cy="250" r="238" fill="${SEAL_PLATE}"/>`);
    // No filters anywhere: not every renderer in that chain supports them, and
    // the soft white emboss ate the thin strokes at thumbnail size.
    expect(asset).not.toContain('<filter');
    expect(asset).not.toContain('feDropShadow');
  });

  it('the inline variant shares the geometry but swaps ink and drops the plate', () => {
    const inline = radixSealSvg({ ink: 'currentColor' });
    // Theme-aware: coloured with currentColor, no fixed brand ink, no plate
    // (it sits on the site's own surface) and sized by its container.
    expect(inline).toContain('stroke="currentColor"');
    expect(inline).not.toContain(SEAL_INK);
    expect(inline).not.toContain(SEAL_PLATE);
    expect(inline).toContain('width="100%"');
    // The inline mark keeps real text (the browser has the font).
    expect(inline).toContain('<text');
    // Same geometry as the file (a load-bearing coordinate from each element).
    expect(inline).toContain('cx="250" cy="250" r="215"');
    // The emblem's vertical-offset group (value may be tuned over time).
    expect(inline).toMatch(/translate\(0,-?\d+\)/);
    expect(inline).toContain('points="250,284 256,290 250,296 244,290"');
  });
});
