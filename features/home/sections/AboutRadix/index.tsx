import { Target, Zap, Info } from 'lucide-react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { SectionHeader } from '@/components/layout/SectionHeader';
import type { BaseSectionProps } from '../../types';

export default function AboutRadix({ t }: BaseSectionProps) {

    const features = [
        { icon: <Target className="size-8" />, title: t.about.mission.title, desc: t.about.mission.description },
        { icon: <Zap className="size-8" />, title: t.about.tech.title, desc: t.about.tech.description },
        { icon: <Info className="size-8" />, title: t.about.team.title, desc: t.about.team.description },
    ];

    return (
        <section id="about" className="py-24 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto overflow-hidden">
            <SectionHeader
                title={t.about.title}
                titleAccent={t.about.subtitle}
                subtitle={t.about.description}
                gradient="from-[var(--color-secondary)] to-[var(--color-primary)]"
            />

            <div className="grid md:grid-cols-3 gap-8 mt-16">
                {features.map((feature, i) => (
                    <ScrollReveal key={`feature-${i}`} from={{ opacity: 0, y: 20 }} delay={i * 0.1} className="group relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] rounded-[2rem] opacity-0 group-hover:opacity-10 transition duration-500 blur" />
                        <div className="relative h-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-[2rem] p-8 hover:border-[var(--color-secondary)] transition-all duration-300">
                            <div className="inline-flex p-3 rounded-2xl bg-[var(--color-bg-secondary)] text-[var(--color-secondary)] mb-6 group-hover:scale-110 transition-transform duration-300">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                            <p className="text-[var(--color-text-muted)] leading-relaxed">{feature.desc}</p>
                        </div>
                    </ScrollReveal>
                ))}
            </div>

            <ScrollReveal from={{ opacity: 0, y: 20 }} delay={0.3} className="mt-20 text-center">
                <a
                    href="https://uploads-ssl.webflow.com/6053f7fca5bf627283b582c2/61d5a4583aad156a094c5628_Radix%20DeFi%20White%20Paper%20v2.05.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-10 py-5 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] rounded-full font-bold text-lg hover:shadow-xl hover:shadow-[var(--color-secondary)]/20 transition-all duration-300"
                >
                    {t.about.whitepapers}
                </a>
            </ScrollReveal>
        </section>
    );
}
