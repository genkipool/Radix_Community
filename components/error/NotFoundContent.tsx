'use client';

import Link from 'next/link';
import { RadixIcon } from '@/components/shared/RadixIcon';


interface NotFoundContentProps {
  title: string;
  description: string;
  ctaText: string;
  homePath?: string;
  status?: string;
  onRetry?: () => void;
  retryText?: string;
}

/**
 * Shared UI component for 404/500 errors.
 * Refined with premium Radix branding and failed transaction icon style.
 */
export function NotFoundContent({
  title,
  description,
  ctaText,
  homePath = '/',
  status = '404',
  onRetry,
  retryText,
}: NotFoundContentProps) {
  return (
    <main className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Mega Background Status Text - Increased visibility for dark mode ([0.12] is more prominent) */}
      <div className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none">
        <span className="text-[20rem] font-black text-[var(--color-text-main)]/[0.12] leading-none md:text-[30rem] filter blur-[1px]">
          {status}
        </span>
      </div>

      {/* Decorative Glow */}
      <div className="absolute left-1/2 top-1/2 -z-20 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary)]/10 blur-[120px]" />

      {/* Large Inverted "Failed" Radix Icon (No animation as requested) */}
      <div className="mb-12">
        <RadixIcon
          className="size-[140px] drop-shadow-[0_0_30px_rgba(239,68,68,0.4)] -scale-y-100"
          strokeColor="#ef4444"
          animate={false}
        />
      </div>

      {/* Status Badge */}
      <div className="mb-6 inline-flex items-center rounded-full border border-red-500/30 bg-red-500/5 px-4 py-1.5 backdrop-blur-md">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
          Status Code: {status}
        </span>
      </div>

      <h1 className="mb-4 text-4xl font-black tracking-tight text-[var(--color-text-main)] md:text-6xl">
        {title}
      </h1>

      <p className="mb-12 max-w-lg text-lg leading-relaxed text-[var(--color-text-muted)]">
        {description}
      </p>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        {onRetry && retryText && (
          <button
            type="button"
            onClick={onRetry}
            className="group relative flex items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface)] border border-[var(--color-card-border)] px-10 py-5 text-sm font-black uppercase tracking-widest text-[var(--color-text-main)] transition-all hover:scale-105 hover:bg-[var(--color-card-border)] active:scale-95 shadow-lg"
          >
            <span className="relative">{retryText}</span>
          </button>
        )}

        <Link href={homePath} className="group transition-all active:scale-95">
          <button type="button" className="flex items-center justify-center bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] h-[56px] rounded-full font-black text-sm uppercase tracking-widest text-white hover:opacity-90 transition-all shrink-0 px-10 shadow-xl hover:shadow-[var(--color-primary)]/20">
            {ctaText}
          </button>
        </Link>
      </div>
    </main>
  );
}
