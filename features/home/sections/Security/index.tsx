import { Shield, FileText, ArrowUpRight } from 'lucide-react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { SectionHeader } from '@/components/layout/SectionHeader';
import type { BaseSectionProps } from '../../types';

export default function Security({ t }: BaseSectionProps) {

  return (
    <section id="seguridad" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Shield className="size-4 mr-1" />}
          badge={t.seguridad.label}
          badgeClassName="bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 text-[var(--color-accent)]"
          title={t.seguridad.h2a}
          titleAccent={t.seguridad.h2b}
          subtitle={t.seguridad.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        >
          <div className="flex flex-wrap justify-center items-center gap-4 mt-8">
            <a
              href={t.seguridad.url_hacken_1}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-primary)' }}
            >
              <FileText className="size-4" />
              {t.seguridad.audit_hacken_1}
              <ArrowUpRight className="size-4" />
            </a>
            <span style={{ color: 'var(--color-card-border)' }}>|</span>
            <a
              href={t.seguridad.url_hacken_2}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--color-primary)' }}
            >
              <FileText className="size-4" />
              {t.seguridad.audit_hacken_2}
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </SectionHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {(t.seguridad.cards as Array<Record<string, string>>).map((card, idx: number) => (
            <ScrollReveal
              key={card.title}
              from={{ opacity: 0, x: idx === 0 ? -50 : 50 }}
              className="bg-[var(--color-surface)] border border-[var(--color-card-border)] p-8 rounded-3xl relative overflow-hidden flex flex-col h-full"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)]" />
              <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-6">{card.title}</h3>
              <p className="text-[var(--color-text-muted)] mb-8 leading-relaxed">{card.desc}</p>

              <div className="p-6 rounded-xl font-mono text-sm bg-[var(--code-bg)] border border-[var(--color-card-border)] shadow-inner flex-grow">
                <span className="text-[var(--code-comment)] italic">{card.comment1}</span><br />
                <div className="mt-4">
                  {idx === 0 ? (
                    <div className="text-[var(--code-punct)]">
                      <span className="text-[var(--code-type)]">balances</span>[<span className="text-[var(--code-keyword)]">msg.sender</span>] <span className="text-red-500 font-bold">-=</span> amount;<br />
                      <span className="text-[var(--code-type)]">balances</span>[recipient] <span className="text-green-500 font-bold">+=</span> amount;
                    </div>
                  ) : (
                    <div className="text-[var(--code-punct)]">
                      <span className="text-[var(--code-keyword)]">let</span> payment <span className="text-[var(--color-primary)] font-bold">=</span> my_vault.<span className="text-[var(--code-keyword)]">take</span>(amount);<br />
                      recipient_account.<span className="text-[var(--code-keyword)]">deposit</span>(payment);
                    </div>
                  )}
                </div>
                <br />
                <span className="text-[var(--code-comment)] mt-2 block">{card.comment2}</span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
