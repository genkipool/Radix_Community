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

export { headline };

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const BRAND_FROM = '#052CC0';
const BRAND_TO = '#3B6BF5';
const SITE_DOMAIN = 'radix-community.genkipool.com';

/** The brand mark, inlined as a data URI (satori embeds SVG through `img`). */
function markDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${BRAND_FROM}" />
      <stop offset="100%" stop-color="${BRAND_TO}" />
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="98" fill="url(#bg)" stroke-width="0"/>
  <g transform="translate(44, 63) scale(0.5)">
    <path d="M0,91.1 L38.35,91.1 L85.85,158.1 L155.45,11 L223.9,11"
      fill="none" stroke="white" stroke-width="22.5"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

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
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '64px 72px',
          background: `linear-gradient(135deg, #020617 0%, #0a1a4d 55%, ${BRAND_FROM} 100%)`,
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Masthead */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markDataUri()} width={72} height={72} alt="" />
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
            Radix Community
          </div>
        </div>

        {/* Subject */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

          <div
            style={{
              display: 'flex',
              fontSize: titleSize(safeTitle.length),
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            {safeTitle}
          </div>

          {subtitle && (
            <div style={{ display: 'flex', fontSize: 28, lineHeight: 1.35, color: '#a9c0ff' }}>
              {/* Meta descriptions are capped near 160 characters, so this fits
                  them whole; only free-form on-ledger text ever gets cut. */}
              {clampCardText(subtitle, 170)}
            </div>
          )}
        </div>

        {/* Footer: figures when there are any, the domain otherwise */}
        {stats && stats.length > 0 ? (
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
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
            <div style={{ display: 'flex', width: 48, height: 5, background: BRAND_TO, borderRadius: 3 }} />
            <div style={{ display: 'flex', fontSize: 24, color: '#8ea6e8' }}>{SITE_DOMAIN}</div>
          </div>
        )}
      </div>
    ),
    OG_SIZE,
  );
}
