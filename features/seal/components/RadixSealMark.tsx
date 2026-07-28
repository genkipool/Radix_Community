/**
 * Theme-aware inline Radix Seal insignia for the website. Same artwork as the
 * on-ledger / watermark file `public/SVGs/radix-seal.svg`, both derived from
 * the single source `radixSealSvg()`. Here it is drawn with `currentColor`, so
 * it inherits the surrounding text colour and adapts to the light/dark theme.
 * Transparent background, no box, no backing plate — the page's own surface is
 * already the right one to sit on.
 */
import { radixSealSvg } from '../lib/radix-seal-svg';

export function RadixSealMark({
  className,
  title,
}: {
  className?: string;
  /** Accessible name; omit to hide from assistive tech. */
  title?: string;
}) {
  return (
    <span
      className={`block aspect-square ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{
        __html: radixSealSvg({ ink: 'currentColor' }),
      }}
    />
  );
}
