/**
 * The social share card, in one place.
 *
 * Every route's `opengraph-image` renders through `ogCard`, so the artwork is
 * designed once and a page only supplies its own words. The alternative was a
 * single generator taking the title as a query parameter, which would have
 * meant an endpoint on this domain that renders arbitrary text onto branded
 * artwork: anyone could have minted a convincing "Radix Community" graphic
 * saying whatever they liked. Route files cannot be pointed at text that is
 * not already on the page.
 *
 * Kept in sync with `scripts/gen-brand-assets.tsx`, which draws the static
 * fallback card and the icons from the same palette and the same mark.
 */
import { ImageResponse } from 'next/og';
import { clampCardText, headline, trimToSentence } from './og-text';
import { OG_BACKDROP_BASE, OG_BACKDROP_DATA_URI } from './generated/og-backdrop';

export { headline };

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const SITE_DOMAIN = 'radix-community.genkipool.com';

/**
 * How wide type is allowed to run.
 *
 * The backdrop puts a large app tile on the right, starting at x=805 as
 * measured on the rendered artwork. Nothing may overlap it, so with 72 of
 * padding the text column stops well short.
 */
const TEXT_COLUMN = 715;

/** The sidebar's headline gradient, `--sidebar-primary` to `--sidebar-secondary`. */
const SIDEBAR_PRIMARY = '#3B9BFF';
const SIDEBAR_SECONDARY = '#2BDFAA';

/** Roughly two lines at the size the subtitle is set. */
const SUBTITLE_MAX = 105;

/**
 * Lifts small text off the artwork.
 *
 * On the glyphs, not on the backdrop: the node mesh runs straight through this
 * text, and a panel behind it hid the drawing the card exists to show. The
 * headline is big enough not to need it.
 */
const TEXT_SHADOW = '0 2px 12px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.8)';



export interface OgStat {
  label: string;
  value: string;
}

export interface OgCardInput {
  title: string;
  subtitle?: string;
  /**
   * Figures along the bottom. On an entity page these are the point of the
   * card: a name alone says nothing, while "3 XRD, 0 delegators" says plenty.
   */
  stats?: OgStat[];
  /** Warning pill next to the eyebrow (an unregistered validator, say). */
  badge?: string;
}


/**
 * Picks a title size that keeps the headline to two lines at most.
 *
 * The largest step matches the sidebar graphic's own headline: its glyphs
 * measure 54px tall on the rendered artwork, which 94px reproduces. The drawing
 * sets 70px in a 560-tall canvas that then scales up to the card, so copying
 * its `fontSize` straight across came out a fifth too short.
 *
 * The steps below it are not chosen by eye. A glyph averages about half its
 * font size in width, so a line holds roughly `TEXT_COLUMN / (size * 0.5)`
 * characters and two lines hold twice that. Each threshold is that figure for
 * its size, which is what keeps a long name from spilling into a third line.
 */
function titleSize(length: number): number {
  const twoLinesFit = (size: number) => length <= (2 * TEXT_COLUMN) / (size * 0.5);
  for (const size of [94, 76, 62]) {
    if (twoLinesFit(size)) return size;
  }
  return 52;
}

export function ogCard({ title, subtitle, stats, badge }: OgCardInput) {
  const safeTitle = clampCardText(title, 90);

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          height: '100%',
          background: OG_BACKDROP_BASE,
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* The sidebar artwork, rasterised. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={OG_BACKDROP_DATA_URI}
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          alt=""
          style={{ position: 'absolute', top: 0, left: 0 }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '64px 72px',
          }}
        >
        {/* Spacer. With the wordmark gone the column holds only the subject and
            the footer, and `space-between` pinned the title to the very top.
            A third slot puts it back near the middle, where the sidebar
            graphic sets its own headline. */}
        <div style={{ display: 'flex' }} />

        {/* Subject. Width-capped so it stops clear of the app tile the artwork
            puts on the right: measured on the rendered backdrop, that tile
            starts at x=805, and with 72 of padding 690 leaves a margin. Text
            must never cross it, in front or behind. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: TEXT_COLUMN }}>
          {badge && (
            <div style={{ display: 'flex' }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: '#fecaca',
                    background: 'rgba(220,38,38,0.35)',
                    border: '2px solid rgba(248,113,113,0.65)',
                    borderRadius: 999,
                    padding: '4px 16px',
                  }}
                >
                  {clampCardText(badge, 24)}
                </div>
            </div>
          )}

          {/* The gradient headline the sidebar uses, primary to secondary.
              Satori paints gradient text the CSS way: the gradient is the
              background and the glyphs clip it. */}
          <div
            style={{
              display: 'flex',
              fontSize: titleSize(safeTitle.length),
              fontWeight: 800,
              lineHeight: 1.24,
              letterSpacing: 1,
              // Shrink-wrapped, so the gradient runs across the words rather
              // than across the whole column and showing only its blue end.
              alignSelf: 'flex-start',
              backgroundImage: `linear-gradient(90deg, ${SIDEBAR_PRIMARY} 0%, ${SIDEBAR_SECONDARY} 100%)`,
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {safeTitle}
          </div>

          {subtitle && (
            <div
              style={{
                display: 'flex',
                fontSize: 34,
                fontWeight: 500,
                lineHeight: 1.35,
                letterSpacing: 0.5,
                color: 'rgba(255,255,255,0.9)',
                textShadow: TEXT_SHADOW,
              }}
            >
              {/* Shorter than the meta description it usually comes from: at
                  full length this ran to five lines straight across the densest
                  part of the artwork, and the backdrop is meant to be seen.
                  Ends on a full stop where one fits, and never on an ellipsis. */}
              {trimToSentence(subtitle, SUBTITLE_MAX)}
            </div>
          )}
        </div>

        {/* Footer: figures when there are any, the domain otherwise */}
        {stats && stats.length > 0 ? (
          <div style={{ display: 'flex', gap: 38, alignItems: 'flex-end', maxWidth: TEXT_COLUMN }}>
            {stats.map((stat) => (
              <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 19,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: '#c8d8ff',
                    textShadow: TEXT_SHADOW,
                  }}
                >
                  {stat.label}
                </div>
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, textShadow: TEXT_SHADOW }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                width: 48,
                height: 5,
                background: '#3B9BFF',
                borderRadius: 3,
              }}
            />
            <div style={{ display: 'flex', fontSize: 24, color: '#c8d8ff', textShadow: TEXT_SHADOW }}>
              {SITE_DOMAIN}
            </div>
          </div>
        )}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
