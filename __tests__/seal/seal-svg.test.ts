import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { radixSealSvg, SEAL_INK } from '@/features/seal/lib/radix-seal-svg';

/**
 * The Radix Seal artwork has a single source of truth (`radixSealSvg`). The
 * standalone file and the website's inline mark both derive from it, so they
 * can never drift. This guards the checked-in file against manual edits: if the
 * geometry changes, regenerate it with `npm run gen:seal-svg`.
 */
describe('Radix Seal SVG single source', () => {
  it('the checked-in public/SVGs/radix-seal.svg matches the generator', () => {
    const onDisk = readFileSync(
      resolve(process.cwd(), 'public/SVGs/radix-seal.svg'),
      'utf8',
    );
    expect(onDisk).toBe(radixSealSvg({ ink: SEAL_INK, emboss: true }));
  });

  it('the inline variant shares the geometry but swaps ink and drops the emboss', () => {
    const inline = radixSealSvg({ ink: 'currentColor', emboss: false });
    // Theme-aware: coloured with currentColor, no fixed brand ink, no filter.
    expect(inline).toContain('stroke="currentColor"');
    expect(inline).not.toContain(SEAL_INK);
    expect(inline).not.toContain('filter="url(#stamped)"');
    // Same geometry as the file (a load-bearing coordinate from each element).
    expect(inline).toContain('cx="250" cy="250" r="215"');
    // The emblem's vertical-offset group (value may be tuned over time).
    expect(inline).toMatch(/translate\(0,-?\d+\)/);
    expect(inline).toContain('points="250,284 256,290 250,296 244,290"');
  });
});
