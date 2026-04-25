/**
 * Hero — RSC shell
 *
 * Split strategy:
 *  ┌─ Hero (RSC) ─────────────────────────────────────────────────────────┐
 *  │  Static layout, DvP code snippet, metrics bar → zero JS bundle cost  │
 *  │  ┌─ HeroCarousel ('use client') ──────────────────────────────────┐  │
 *  │  │  Slides with useState/useEffect/AnimatePresence                 │  │
 *  │  └────────────────────────────────────────────────────────────────┘  │
 *  │  ┌─ InstitutionalPilotButton ('use client') ──────────────────────┐  │
 *  │  │  One useState for modal open/close                              │  │
 *  │  └────────────────────────────────────────────────────────────────┘  │
 *  └──────────────────────────────────────────────────────────────────────┘
 */
import Link from 'next/link';
import HeroCarousel from './components/HeroCarousel';
import InstitutionalPilotButton from '@/features/home/components/InstitutionalPilotButton';
import type { HeroProps } from '../../types';

export default function Hero({ t, locale }: HeroProps) {
  return (
    <section
      id="hero"
      className="relative min-h-screen pt-32 pb-20 overflow-hidden flex flex-col justify-center"
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-64 w-[500px] h-[500px] bg-[var(--color-primary)]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-64 w-[500px] h-[500px] bg-[var(--color-secondary)]/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-end">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-7">
            {/* Badge adaptativo a los temas */}
            <div className="inline-flex items-center gap-2 px-4 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-card-border)] text-sm font-medium text-[var(--color-primary)] mb-5 shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
              <span className="leading-none">{t.hero.badge}</span>
            </div>

            {/* Client island — animated carousel */}
            <HeroCarousel t={t} />

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              {/* Client island — modal trigger only */}
              <InstitutionalPilotButton
                label={t.hero.btn_inst}
                className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold hover:opacity-90 transition-opacity"
              />
              <Link
                href={`/${locale}/docs`}
                className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)]"
              >
                {t.hero.btn_dev}
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN — Radix Transaction Manifest */}
          <div className="relative lg:col-span-5 hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10 rounded-2xl blur-2xl" />
            <div
              title={t.hero.snippet.tooltip}
              className="relative bg-[var(--code-bg)] border border-[var(--color-card-border)] rounded-2xl overflow-hidden font-mono text-[11px] shadow-xl cursor-default"
            >

              {/* Window chrome */}
              <div className="flex items-center px-4 py-3 border-b border-[var(--color-card-border)] bg-[var(--color-text-main)]/5">
                <span className="text-xs font-bold tracking-wider text-[var(--color-text-muted)] opacity-80 uppercase shrink-0 leading-none mt-[2px]">
                  {t.hero.snippet.title}
                </span>
              </div>

              {/* Code Container */}
              <div className="px-5 py-4 space-y-3 leading-relaxed text-[var(--code-punct)]">

                {/* Step 1 */}
                <div>
                  <div className="mb-1 text-[10px] text-[var(--code-comment)]">{t.hero.snippet.step1_comment}</div>
                  <div><span className="font-bold text-[var(--code-keyword)]">CALL_METHOD</span></div>
                  <div className="pl-4">
                    <span className="text-[var(--code-type)]">Address</span>(
                    <span className="text-[var(--code-string)]">{'"account_sim1_banco_treasury..."'}</span>){' '}
                    <span className="font-semibold text-[var(--code-string)]">{'"withdraw"'}</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-[var(--code-type)]">Address</span>(
                    <span className="text-[var(--code-string)]">{'"resource_sim1_eur_cbdc..."'}</span>){' '}
                    <span className="font-bold text-[var(--code-type)]">Decimal</span>(
                    <span className="font-black text-[var(--code-string)]">{'"10000000"'}</span>);
                  </div>
                  <div className="mt-1"><span className="font-bold text-[var(--code-keyword)]">TAKE_FROM_WORKTOP</span></div>
                  <div className="pl-4">
                    <span className="text-[var(--code-type)]">Address</span>(
                    <span className="text-[var(--code-string)]">{'"resource_sim1_eur_cbdc..."'}</span>){' '}
                    <span className="font-bold text-[var(--code-type)]">Decimal</span>(
                    <span className="font-black text-[var(--code-string)]">{'"10000000"'}</span>)
                  </div>
                  <div className="pl-4">
                    <span className="font-semibold text-[var(--code-type)]">Bucket</span>(
                    <span className="font-normal text-[var(--code-string)]">{'"bucket_cbdc_banco"'}</span>);
                  </div>
                </div>

                <div className="border-t border-[var(--color-card-border)] opacity-30" />

                {/* Step 2 */}
                <div>
                  <div className="mb-1 text-[10px] text-[var(--code-comment)]">{t.hero.snippet.step2_comment}</div>
                  <div><span className="font-bold text-[var(--code-keyword)]">CALL_METHOD</span></div>
                  <div className="pl-4">
                    <span className="text-[var(--code-type)]">Address</span>(
                    <span className="text-[var(--code-string)]">{'"account_sim1_fondo_institucional..."'}</span>){' '}
                    <span className="font-semibold text-[var(--code-string)]">{'"withdraw"'}</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-[var(--code-type)]">Address</span>(
                    <span className="text-[var(--code-string)]">{'"resource_sim1_rwa_bond..."'}</span>){' '}
                    <span className="font-bold text-[var(--code-type)]">Decimal</span>(
                    <span className="font-black text-[var(--code-string)]">{'"200000"'}</span>);
                  </div>
                  <div className="mt-1"><span className="font-bold text-[var(--code-keyword)]">TAKE_FROM_WORKTOP</span></div>
                  <div className="pl-4">
                    <span className="text-[var(--code-type)]">Address</span>(
                    <span className="text-[var(--code-string)]">{'"resource_sim1_rwa_bond..."'}</span>){' '}
                    <span className="font-bold text-[var(--code-type)]">Decimal</span>(
                    <span className="font-black text-[var(--code-string)]">{'"200000"'}</span>)
                  </div>
                  <div className="pl-4">
                    <span className="font-semibold text-[var(--code-type)]">Bucket</span>(
                    <span className="font-normal text-[var(--code-string)]">{'"bucket_bonos_fondo"'}</span>);
                  </div>
                </div>

                <div className="border-t border-[var(--color-card-border)] opacity-30" />

                {/* Step 3 */}
                <div>
                  <div className="mb-1 text-[10px] text-[var(--code-comment)]">{t.hero.snippet.step3_comment}</div>
                  <div><span className="font-bold text-[var(--code-keyword)]">CALL_METHOD</span></div>
                  <div className="pl-4">
                    <span className="text-[var(--code-type)]">Address</span>(
                    <span className="text-[var(--code-string)]">{'"account_sim1_banco..."'}</span>){' '}
                    <span className="font-semibold text-[var(--code-string)]">{'"deposit"'}</span>
                  </div>
                  <div className="pl-4">
                    <span className="font-semibold text-[var(--code-type)]">Bucket</span>(
                    <span className="font-normal text-[var(--code-string)]">{'"bucket_bonos_fondo"'}</span>);
                  </div>
                  <div className="mt-1"><span className="font-bold text-[var(--code-keyword)]">CALL_METHOD</span></div>
                  <div className="pl-4">
                    <span className="text-[var(--code-type)]">Address</span>(
                    <span className="text-[var(--code-string)]">{'"account_sim1_fondo..."'}</span>){' '}
                    <span className="font-semibold text-[var(--code-string)]">{'"deposit"'}</span>
                  </div>
                  <div className="pl-4">
                    <span className="font-semibold text-[var(--code-type)]">Bucket</span>(
                    <span className="font-normal text-[var(--code-string)]">{'"bucket_cbdc_banco"'}</span>);
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Metrics bar — RSC */}
        <div className="mt-24 pt-12 border-t border-[var(--color-card-border)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] mb-2">2²⁵⁶</div>
              <div className="text-sm text-[var(--color-text-muted)] font-medium min-h-[40px]">{t.hero.metric1}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--color-text-main)] mb-2">100%</div>
              <div className="text-sm text-[var(--color-text-muted)] font-medium min-h-[40px]">{t.hero.metric2}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] mb-2">ROA</div>
              <div className="text-sm text-[var(--color-text-muted)] font-medium min-h-[40px]">{t.hero.metric3}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--color-text-main)] mb-2">T+0</div>
              <div className="text-sm text-[var(--color-text-muted)] font-medium min-h-[40px]">{t.hero.metric4}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}