/**
 * Regenerates the standalone Radix Seal asset `public/SVGs/radix-seal.svg`
 * from the single source of truth `features/seal/lib/radix-seal-svg.ts`.
 * Run with `pnpm gen:seal-svg` whenever the artwork changes.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  radixSealSvg,
  SEAL_INK,
  SEAL_PLATE,
} from '../features/seal/lib/radix-seal-svg';

const target = resolve(process.cwd(), 'public/SVGs/radix-seal.svg');
// The asset variant, in three parts (see radix-seal-svg.ts for the why):
// letters as traced outlines (no renderer here ships Montserrat), an opaque
// plate (the backgrounds it lands on are not ours), and a real intrinsic size
// (`100%` resolves against nothing outside a browser layout).
writeFileSync(
  target,
  radixSealSvg({
    ink: SEAL_INK,
    plate: SEAL_PLATE,
    lettersAsPaths: true,
    fluid: false,
  }),
);
console.log(`Wrote ${target}`);
