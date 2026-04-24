'use client';
import React, { useState } from 'react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { TagFilterBar } from "@/components/ui/TagFilterBar";
// ── PhaseGraphics is intentionally NOT imported statically here ───────────────
// A static `import * as Graphics from './components/PhaseGraphics'` would pull
// PhaseGraphics.css (~31 KiB) into the SSR critical-CSS chain and cause
// Lighthouse's "render-blocking requests" warning.
// LazyPhaseGraphic loads the module dynamically inside useEffect (browser-only),
// so its CSS is never seen by the server renderer and lands in an async chunk.
import { LazyPhaseGraphic } from './components/LazyPhaseGraphic';
import type { EcosystemProps } from '../../types';

export default function Ecosystem({ t, language }: EcosystemProps) {
  const [activeTag, setActiveTag] = useState<string>("All");

  // Reset filter when language changes to avoid mismatch with localized tags
  const [prevLanguage, setPrevLanguage] = useState(language);
  if (language !== prevLanguage) {
    setPrevLanguage(language);
    setActiveTag("All");
  }

  const phases = Array.from({ length: 32 }, (_, i) => {
    const n = i + 1;
    const eco = t.ecosistema as unknown as Record<string, string>;
    return {
      num: n,
      title: eco[`phase${n}_title`] ?? '',
      desc: eco[`phase${n}_desc`] ?? '',
      tag: eco[`phase${n}_tag`] ?? ''
    };
  });

  // Extract unique logical grouped tags (excluding "All" for TagFilterBar)
  const logicalTags = (() => {
    const tags = new Set<string>();
    phases.forEach(p => tags.add(p.tag));
    return Array.from(tags);
  })();

  const filteredPhases = (() => {
    if (activeTag === "All") return phases;
    return phases.filter(p => p.tag === activeTag);
  })();

  const renderGraphic = (num: number) => (
    <LazyPhaseGraphic num={num} t={t} />
  );

  return (
    <section id="ecosistema" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--color-primary)_0%,transparent_100%)] opacity-[0.015] pointer-events-none" />

      {/* Increased padding / narrower wrapper by replacing max-w-[1200px] with max-w-[1400px] and increasing px */}
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          title={t.ecosistema.h2a}
          titleAccent={t.ecosistema.h2b}
          subtitle={t.ecosistema.sub}
        />
        <ScrollReveal
          from={{ opacity: 0, y: 10 }}
          delay={0.2}
          className="mb-16"
        >
          <TagFilterBar
            tags={logicalTags}
            activeTag={activeTag === "All" ? null : activeTag}
            onSelect={(tag) => setActiveTag(tag || "All")}
            allLabel={t.ecosistema.all}
          />
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5 min-h-[500px]">
          {filteredPhases.map((phase) => (
            <ScrollReveal
              key={phase.num}
              from={{ opacity: 0, scale: 0.95 }}
              className="h-full"
            >
              <div
                className="glass-card pt-8 px-8 pb-4 flex flex-col h-full group relative overflow-visible radix-svg transition-all duration-300 shadow-sm hover:shadow-md"
                style={{
                  background: "var(--color-bg)",
                  borderColor: "transparent"
                }}
              >
                <div className="mb-2 pr-4 flex items-center min-h-[3.5rem]">
                  <span className="text-2xl font-black tracking-tighter text-[var(--color-primary)] mr-3 opacity-80">
                    {phase.num < 10 ? `0${phase.num}` : phase.num}
                  </span>
                  <h3 className="text-xl font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors leading-tight">
                    {phase.title}
                  </h3>
                </div>

                <div className="my-6 h-[140px] flex items-center justify-center w-full relative z-0">
                  {renderGraphic(phase.num)}
                </div>

                <p className="text-[var(--color-text-muted)] text-base leading-relaxed mt-auto pt-4 border-t border-[var(--color-border)]/40 relative z-10 min-h-[160px]">
                  {phase.desc}
                </p>

                {/* Dedicated Tag section with more spacing from description */}
                <div className="mt-6 flex justify-end relative z-20">
                  <span className="inline-flex items-center px-3 py-1 rounded-full border border-[var(--color-border)] text-[0.65rem] font-bold tracking-wider uppercase text-[var(--color-text-muted)] group-hover:border-[var(--color-primary)]/30 group-hover:text-[var(--color-text-main)] bg-[var(--color-bg-alt)] transition-colors">
                    {phase.tag}
                  </span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
        {
          filteredPhases.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] py-12">No items found for this tag.</div>
          )
        }
      </div>
    </section>
  );
}
