/**
 * Rigor — RSC
 *
 * Honesty section: what exists in production today vs. what would need
 * building.
 */
import { CheckCircle2, Hammer, ShieldAlert } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { SectionHeader } from '@/components/layout/SectionHeader';
import type { GoogleWalletSectionProps } from '../../types';

/** Checklist panel used for the "today" and "to build" columns. */
function ChecklistPanel({
  icon,
  title,
  items,
  markerClass,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  markerClass: string;
}) {
  return (
    <FadeIn className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl h-full">
      <div className="flex items-center gap-3 mb-6">
        {icon}
        <h3 className="text-xl font-bold text-[var(--color-text-main)]">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className={`size-1.5 rounded-full mt-2 shrink-0 ${markerClass}`} />
            <span className="text-sm text-[var(--color-text-muted)] leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </FadeIn>
  );
}

export default function Rigor({ t }: GoogleWalletSectionProps) {
  const rigor = t.googleWallet.rigor;

  return (
    <section id="rigor" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<ShieldAlert className="size-3.5 text-[var(--color-primary)]" />}
          badge={rigor.label}
          title={rigor.h2a}
          titleAccent={rigor.h2b}
          subtitle={rigor.sub}
        />

        {/* Today vs. to-build columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChecklistPanel
            icon={<CheckCircle2 className="size-7 text-emerald-500" />}
            title={rigor.today_title}
            items={rigor.today}
            markerClass="bg-emerald-500"
          />
          <ChecklistPanel
            icon={<Hammer className="size-7 text-[var(--color-secondary)]" />}
            title={rigor.build_title}
            items={rigor.build}
            markerClass="bg-[var(--color-secondary)]"
          />
        </div>
      </div>
    </section>
  );
}
