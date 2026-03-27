import Link from 'next/link';
import { Smartphone, Ban, Monitor, Shield, BadgeCheck, KeyRound } from 'lucide-react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { IconFeatureItem } from '@/components/ui/IconFeatureItem';
import RadixWalletSVG from './components/RadixWalletSVG';
import type { BaseSectionProps } from '../../types';

export default function Wallet({ t }: BaseSectionProps) {

  return (
    <section id="wallet" className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <ScrollReveal from={{ opacity: 0, x: -50 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/30 text-sm font-medium text-[var(--color-secondary)] mb-6">
              <Smartphone className="w-4 h-4 text-[var(--color-secondary)]" />
              {t.wallet.label}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[var(--color-text-main)] mb-6 tracking-tight">
              {t.wallet.h2a}<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]">{t.wallet.h2b}</span>
            </h2>
            <p className="text-xl text-[var(--color-text-muted)] mb-10 leading-relaxed">
              {t.wallet.sub}
            </p>

            <div className="space-y-8 mb-10">
              {/* Features using reusable IconFeatureItem component */}
              {[
                { icon: <Ban className="w-6 h-6 text-[var(--color-primary)]" />, title: t.wallet.features[0].title, desc: t.wallet.features[0].desc },
                { icon: <Monitor className="w-6 h-6 text-[var(--color-secondary)]" />, title: t.wallet.features[1].title, desc: t.wallet.features[1].desc },
                { icon: <Shield className="w-6 h-6 text-[var(--color-accent)]" />, title: t.wallet.features[2].title, desc: t.wallet.features[2].desc },
                { icon: <BadgeCheck className="w-6 h-6 text-[var(--color-primary)]" />, title: t.wallet.features[3].title, desc: t.wallet.features[3].desc },
                { icon: <KeyRound className="w-6 h-6 text-[var(--color-secondary)]" />, title: t.wallet.features[4].title, desc: t.wallet.features[4].desc }
              ].map((feature, i) => (
                <div key={i}>
                  <IconFeatureItem
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.desc}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href={t.wallet.urlIOS} target="_blank" rel="noopener noreferrer" className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-[var(--color-text-main)] font-bold hover:opacity-90 transition-opacity">
                {t.wallet.btnIOS}
              </Link>
              <Link href={t.wallet.urlAndroid} target="_blank" rel="noopener noreferrer" className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)]">
                {t.wallet.btnAndroid}
              </Link>
              <Link href={t.wallet.urlChrome} target="_blank" rel="noopener noreferrer" className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-[var(--color-surface)] text-[var(--color-text-main)] font-bold hover:text-[var(--color-primary)] transition-colors border border-[var(--color-card-border)]">
                {t.wallet.btnChrome}
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal
            from={{ opacity: 0, scale: 0.9 }}
            className="relative h-[850px] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-secondary)]/20 to-[var(--color-primary)]/20 rounded-full blur-[100px]" />

            {/* Radix Wallet SVG */}
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <RadixWalletSVG className="w-full h-full" />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
