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
import { clampCardText, headline } from './og-text';
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
const TEXT_COLUMN = 690;

/** The sidebar's headline gradient, `--sidebar-primary` to `--sidebar-secondary`. */
const SIDEBAR_PRIMARY = '#3B9BFF';
const SIDEBAR_SECONDARY = '#2BDFAA';

/** Roughly two lines at the size the subtitle is set. */
const SUBTITLE_MAX = 105;



export interface OgStat {
  label: string;
  value: string;
}

export interface OgCardInput {
  /** Small line above the title: the section, or what kind of thing this is. */
  eyebrow?: string;
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


/** Long titles need to step down a size or they wrap to four lines. */
function titleSize(length: number): number {
  if (length <= 28) return 76;
  if (length <= 55) return 62;
  return 50;
}

export function ogCard({ eyebrow, title, subtitle, stats, badge }: OgCardInput) {
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
        {/* Masthead, set as the sidebar graphic sets its own: plain white, no
            mark. The artwork already carries the logo as its app tile, and a
            second one beside it read as a duplicate. */}
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, letterSpacing: 0.5 }}>
          Radix Community
        </div>

        {/* Subject. Width-capped so it stops clear of the app tile the artwork
            puts on the right: measured on the rendered backdrop, that tile
            starts at x=805, and with 72 of padding 690 leaves a margin. Text
            must never cross it, in front or behind. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: TEXT_COLUMN }}>
          {(eyebrow || badge) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {eyebrow && (
                <div
                  style={{
                    display: 'flex',
                    fontSize: 24,
                    fontWeight: 600,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: '#8ea6e8',
                  }}
                >
                  {clampCardText(eyebrow, 40)}
                </div>
              )}
              {badge && (
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
              )}
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
              lineHeight: 1.1,
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
              }}
            >
              {/* Shorter than the meta description it usually comes from. At
                  full length this ran to five lines straight across the densest
                  part of the artwork, and the backdrop is meant to be seen. */}
              {clampCardText(subtitle, SUBTITLE_MAX)}
            </div>
          )}
        </div>

        {/* Footer: figures when there are any, the domain otherwise */}
        {stats && stats.length > 0 ? (
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end', maxWidth: TEXT_COLUMN }}>
            {stats.map((stat) => (
              <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 19,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: '#8ea6e8',
                  }}
                >
                  {stat.label}
                </div>
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>{stat.value}</div>
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
            <div style={{ display: 'flex', fontSize: 24, color: '#8ea6e8' }}>{SITE_DOMAIN}</div>
          </div>
        )}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
