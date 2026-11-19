import { ExternalLink, FileEdit, ShieldAlert, UserCheck, Users, Vote } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { DAO_EXTERNAL_LINKS } from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';
import { DaoSection } from './DaoSection';

interface DaoParticipateSectionProps {
  participate: DaoCopy['participate'];
}

const ITEM_CONFIG: Record<string, { icon: typeof Vote; href: string; external: boolean }> = {
  propose: {
    icon: FileEdit,
    href: '#doc-proposal-and-voting-framework',
    external: false,
  },
  vote: {
    icon: Vote,
    href: DAO_EXTERNAL_LINKS.vote,
    external: true,
  },
  stand: {
    icon: UserCheck,
    href: '#doc-elections-and-role-governance-policy',
    external: false,
  },
  challenge: {
    icon: ShieldAlert,
    href: '#contact',
    external: false,
  },
};

export function DaoParticipateSection({ participate }: DaoParticipateSectionProps) {
  return (
    <DaoSection id="participate" surface="muted">
        <SectionHeader
          icon={<Users className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />}
          badge={participate.badge}
          title={participate.title}
          titleAccent={participate.titleAccent}
          subtitle={participate.subtitle}
        />

        {/* Hyperscale FeatureCard aesthetic: clean, single-level cards with subtle corner glow */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {participate.items.map((item, i) => {
            const cfg = ITEM_CONFIG[item.key] ?? ITEM_CONFIG.vote;
            const Icon = cfg.icon;

            return (
              <FadeIn
                key={item.key}
                delay={i * 0.06}
                className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between group hover:border-[var(--color-secondary)]/40 transition-colors"
              >
                <div className="absolute top-0 right-0 size-32 bg-[var(--color-secondary)]/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                <div className="relative z-10">
                  <div className="mb-5">
                    <Icon className="size-7 text-[var(--color-primary)]" aria-hidden="true" />
                  </div>
                  <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                    {item.meta}
                  </span>
                  <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="relative z-10 mt-6 pt-4 border-t border-[var(--color-card-border)]">
                  <a
                    href={cfg.href}
                    {...(cfg.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-secondary)] hover:underline"
                  >
                    <span>{item.cta}</span>
                    {cfg.external && <ExternalLink className="size-3.5" aria-hidden="true" />}
                  </a>
                </div>
              </FadeIn>
            );
          })}
        </div>
    </DaoSection>
  );
}
