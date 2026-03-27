/**
 * Desarrolladores — RSC
 *
 * Replaced the previous 'use client' monolith with the RSC slots pattern:
 *   ┌─ Desarrolladores (RSC) ────────────────────────────────────────────────┐
 *   │  Renders section chrome + SectionHeader + ScrollReveal (RSC)           │
 *   │  ┌─ DesarrolladoresShell ('use client') ──────────────────────────┐    │
 *   │  │  Owns only: activeTab useState + tab nav buttons               │    │
 *   │  │  Receives content panels as ReactNode props (RSC subtrees)     │    │
 *   │  └────────────────────────────────────────────────────────────────┘    │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 * The four tab panels (DevTab0–3) and DevConsole are rendered server-side and
 * passed as children, so they never enter the client JS bundle.
 */
import { Zap } from 'lucide-react';
import { Suspense } from 'react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { DevShell } from './components/DevShell';
import { DevTab0, DevTab1, DevTab2, DevTab3 } from './components/DevsContent';
import type { BaseSectionProps } from '../../types';

export default function DevSection({ t }: BaseSectionProps) {
  return (
    <section id="para-devs" className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Zap className="w-4 h-4 shrink-0" />}
          badge={t.devs.label}
          badgeClassName="bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]"
          title={t.devs.h2a}
          titleAccent={t.devs.h2b}
          subtitle={t.devs.sub}
        />

        {/* Client island: only the tab switcher state lives here.
            Wrapped in Suspense because it uses searchParams for state sync. */}
        <Suspense fallback={<div className="min-h-[500px]" />}>
          <DevShell
            t={t}
            tabs={t.devs.tabs as unknown as string[]}
            tab0={<DevTab0 t={t} />}
            tab1={<DevTab1 t={t} />}
            tab2={<DevTab2 t={t} />}
            tab3={<DevTab3 t={t} />}
          />
        </Suspense>
      </div>
    </section>
  );
}
