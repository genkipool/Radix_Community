'use client';

import { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */

/**
 * 'gradient-text' → icon rendered with CSS gradient text-fill (used by Docs).
 * 'icon-box'      → icon rendered inside a rounded coloured box (used by Games).
 */
export type FeaturedCardIconVariant = 'gradient-text' | 'icon-box';

export interface FeaturedCardProps {
  /** Click handler — receives no args; caller decides what to do with the id */
  onClick: () => void;
  /** Tailwind gradient classes for the icon (e.g. 'from-blue-500 to-cyan-400') */
  gradient: string;
  /** RGB triplet used for the subtle card background tint (e.g. '59,130,246') */
  accentRgb: string;
  /** How the icon is rendered — defaults to 'icon-box' */
  iconVariant?: FeaturedCardIconVariant;
  /** The icon element itself (styled internally based on iconVariant) */
  icon: ReactNode;
  /** Small uppercase label shown above the title (category / topic) */
  badgeLabel: string;
  title: string;
  description: string;
  /** Label for the bottom CTA link */
  ctaLabel: string;
  /** Optional badge rendered absolutely at top-right (e.g. "Tournament") */
  topBadge?: ReactNode;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function FeaturedCard({
  onClick,
  gradient,
  accentRgb,
  iconVariant = 'icon-box',
  icon,
  badgeLabel,
  title,
  description,
  ctaLabel,
  topBadge,
}: FeaturedCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start p-8 text-left rounded-3xl border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      style={{
        borderColor: 'var(--color-card-border)',
        background: `linear-gradient(135deg, rgba(${accentRgb},0.07) 0%, transparent 55%)`,
      }}
    >
      {/* ── Icon ── */}
      {iconVariant === 'icon-box' ? (
        <div
          className={`w-12 h-12 mb-5 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}
        >
          {icon}
        </div>
      ) : (
        <div
          className={`relative mb-5 shrink-0 group-hover:scale-110 transition-transform duration-300 bg-gradient-to-br ${gradient}`}
          style={{
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {icon}
        </div>
      )}

      {/* ── Category / topic badge ── */}
      <span
        className="text-xs font-bold uppercase tracking-widest mb-2"
        style={{ color: 'var(--color-primary)', opacity: 0.75 }}
      >
        {badgeLabel}
      </span>

      {/* ── Title ── */}
      <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-main)' }}>
        {title}
      </h3>

      {/* ── Description ── */}
      <p className="text-sm leading-relaxed flex-1 mb-6" style={{ color: 'var(--color-text-muted)' }}>
        {description}
      </p>

      {/* ── CTA link ── */}
      <div
        className="mt-auto flex items-center text-sm font-semibold"
        style={{ color: 'var(--color-primary)' }}
      >
        {ctaLabel}
        <ArrowUpRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 translate-y-2 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-300" />
      </div>

      {/* ── Optional top-right absolute badge ── */}
      {topBadge}
    </button>
  );
}
