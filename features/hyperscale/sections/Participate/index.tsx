/**
 * Participate — RSC
 *
 * How the community runs a node and joins Hyperscale's public tests. Mirrors
 * the real interim-test flow (OpenJDK 21 + hyperscale.jar) documented in the
 * radixlabs.net setup guides, plus quick facts on the last/next public test.
 */
import Link from 'next/link';
import {
  Server,
  Coffee,
  Download,
  Network,
  Terminal,
  Radar,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { HYPERSCALE_LINKS } from '../../data/links';
import { CopyButton } from '@/components/ui/CopyButton';
import type { HyperscaleSectionProps } from '../../types';

const STEP_ICONS = [Coffee, Download, Network, Terminal, Radar];

export default function Participate({ t }: HyperscaleSectionProps) {
  const p = t.hyperscale.participate;

  const guides = [
    { label: p.guide_windows, href: HYPERSCALE_LINKS.guideWindows },
    { label: p.guide_mac, href: HYPERSCALE_LINKS.guideMac },
    { label: p.guide_linux, href: HYPERSCALE_LINKS.guideLinux },
  ];

  return (
    <section id="participate" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Server className="size-3.5 text-[var(--color-primary)]" />}
          badge={p.label}
          title={p.h2a}
          titleAccent={p.h2b}
          subtitle={p.sub}
        />

        {/* Quick facts (one-line list) + minimum requirements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-14">
          <FadeIn className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl p-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
              {p.facts_title}
            </h3>
            <ul className="divide-y divide-[var(--color-card-border)]">
              {p.facts.map((fact) => (
                <li key={fact.label} className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-[var(--color-text-muted)]">{fact.label}</span>
                  <span className="text-sm font-bold text-[var(--color-text-main)] text-right">{fact.value}</span>
                </li>
              ))}
            </ul>
          </FadeIn>

          <FadeIn delay={0.1} className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl p-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
              {p.req_title}
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {p.reqs.map((req) => (
                <li key={req} className="flex items-center gap-2.5 text-sm text-[var(--color-text-main)]">
                  <CheckCircle2 className="size-4 text-[var(--color-primary)] shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>

        {/* Setup steps */}
        <FadeIn className="mb-8">
          <h3 className="text-2xl font-bold text-[var(--color-text-main)]">{p.steps_title}</h3>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
          {p.steps.map((step, i) => {
            const Icon = STEP_ICONS[i] ?? Terminal;
            return (
              <FadeIn
                key={step.title}
                delay={i * 0.08}
                className="flex flex-col bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white text-sm font-black shrink-0">
                    {i + 1}
                  </span>
                  <Icon className="size-5 text-[var(--color-secondary)]" />
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text-main)] mb-2">{step.title}</h4>
                <p 
                  className="text-xs text-[var(--color-text-muted)] leading-relaxed break-words [&_a]:text-[var(--color-secondary)] [&_a:hover]:underline [&_a]:transition-colors [&_b]:font-bold [&_b]:text-[var(--color-text-main)]"
                  dangerouslySetInnerHTML={{ __html: step.desc }}
                />
              </FadeIn>
            );
          })}
        </div>

        {/* Run commands */}
        <FadeIn className="mb-12 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                <Terminal className="size-4 text-[var(--color-secondary)]" />
                Linux (Ubuntu/Debian)
              </h4>
              <div className="bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-xl px-5 py-4 font-mono text-sm text-[var(--color-text-main)] overflow-x-auto flex items-center justify-between gap-4">
                <span className="whitespace-nowrap select-all text-[var(--color-text-muted)]">$ <span className="text-[var(--color-text-main)]">sudo apt install openjdk-21-jdk</span></span>
                <CopyButton value="sudo apt install openjdk-21-jdk" variant="ghost" size="sm" className="shrink-0" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                <Terminal className="size-4 text-[var(--color-secondary)]" />
                macOS
              </h4>
              <div className="bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-xl px-5 py-4 font-mono text-sm text-[var(--color-text-main)] overflow-x-auto flex items-center justify-between gap-4">
                <span className="whitespace-nowrap select-all text-[var(--color-text-muted)]">$ <span className="text-[var(--color-text-main)]">brew install openjdk@21</span></span>
                <CopyButton value="brew install openjdk@21" variant="ghost" size="sm" className="shrink-0" />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
              <Radar className="size-4 text-[var(--color-secondary)]" />
              Run Hyperscale
            </h4>
            <div className="bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-xl px-5 py-4 font-mono text-sm text-[var(--color-text-main)] overflow-x-auto flex items-center justify-between gap-4">
              <span className="whitespace-nowrap select-all text-[var(--color-text-muted)]">$ <span className="text-[var(--color-text-main)]">{p.run_cmd}</span></span>
              <CopyButton value={p.run_cmd} variant="ghost" size="sm" className="shrink-0" />
            </div>
          </div>
        </FadeIn>

        {/* CTAs */}
        <FadeIn className="flex flex-col items-center gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-[var(--color-text-muted)]">
            <span>{p.guides_intro}</span>
            <div className="flex flex-wrap justify-center gap-2">
              {guides.map((guide) => (
                <Link
                  key={guide.label}
                  href={guide.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-card-bg)] font-semibold text-[var(--color-text-main)] hover:border-[var(--color-secondary)]/50 transition-colors"
                >
                  <FileText className="size-3.5 text-[var(--color-secondary)]" />
                  {guide.label}
                </Link>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn className="mt-10 max-w-3xl mx-auto">
          <p 
            className="text-xs text-[var(--color-text-muted)] italic leading-relaxed text-center [&_a]:text-[var(--color-secondary)] [&_a:hover]:underline [&_a]:transition-colors"
            dangerouslySetInnerHTML={{ __html: p.note }}
          />
        </FadeIn>
      </div>
    </section>
  );
}
