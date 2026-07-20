/**
 * Regenerates the standalone Radix Seal asset `public/SVGs/radix-seal.svg`
 * from the single source of truth `features/seal/lib/radix-seal-svg.ts`.
 * Run with `npm run gen:seal-svg` whenever the artwork changes.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { radixSealSvg, SEAL_INK } from '../features/seal/lib/radix-seal-svg';

const target = resolve(process.cwd(), 'public/SVGs/radix-seal.svg');
// Letters as traced outlines: wallet NFT renderers ship no Montserrat and
// have unreliable <text> support, so the on-ledger asset embeds geometry.
writeFileSync(
  target,
  radixSealSvg({ ink: SEAL_INK, emboss: true, lettersAsPaths: true }),
);
console.log(`Wrote ${target}`);
