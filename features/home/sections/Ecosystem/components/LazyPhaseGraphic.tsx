'use client';
/**
 * LazyPhaseGraphic — client-only dynamic graphic loader
 *
 * WHY THIS EXISTS:
 * ─────────────────────────────────────────────────────────────────────────────
 * PhaseGraphics.tsx imports PhaseGraphics.css (≈31 KiB). A static import of
 * that module — even one hidden behind next/dynamic on the page — causes
 * Next.js to include PhaseGraphics.css in the SSR HTML as a render-blocking
 * <link> in <head>.
 *
 * The ONLY reliable way to move a CSS file out of the blocking critical path
 * is to ensure it is never imported in any statically-analysable import chain
 * that runs during SSR. This component achieves that by:
 *
 *   1. Being a pure client component (never executed on the server).
 *   2. Importing PhaseGraphics **dynamically inside useEffect**, which runs
 *      only in the browser, after the page has already painted.
 *
 * Result: PhaseGraphics.css is loaded as a non-blocking async chunk,
 * eliminating the ~120 ms render-blocking penalty identified by Lighthouse.
 *
 * SEO is unaffected — card titles, descriptions, and tags are all rendered
 * by the parent Ecosystem component, which remains SSR.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect, useRef } from 'react';

interface LazyPhaseGraphicProps {
  num: number;
  t?: unknown;
}

/** Minimal animated placeholder shown while the graphic module loads */
function GraphicSkeleton() {
  return (
    <div
      className="w-full h-[120px] rounded-lg animate-pulse"
      style={{ background: 'var(--color-border, rgba(100,100,100,0.1))' }}
      aria-hidden="true"
    />
  );
}

export function LazyPhaseGraphic({ num, t }: LazyPhaseGraphicProps) {
  const [Graphic, setGraphic] = useState<React.ComponentType<{ t?: unknown }> | null>(null);
  // Track whether the component is still mounted to avoid setState after unmount
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    // Dynamic import runs entirely in the browser — PhaseGraphics.css is
    // loaded here, never during SSR, so it cannot block the initial render.
    import('./PhaseGraphics').then((mod) => {
      if (!isMounted.current) return;
      const key = `Graphic${num}` as keyof typeof mod;
      const Component = mod[key] as React.ComponentType<{ t?: unknown }> | undefined;
      if (Component) setGraphic(() => Component);
    });

    return () => {
      isMounted.current = false;
    };
  }, [num]);

  if (!Graphic) return <GraphicSkeleton />;

  return (
    <div className="w-full flex items-center justify-center overflow-visible">
      <Graphic t={t} />
    </div>
  );
}
