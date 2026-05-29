'use client';
import { Portal } from '@/components/ui/Portal';
import Link from 'next/link';
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ExternalLink,
  Database, Network, Code2, TrendingUp, ArrowLeftRight,
  Monitor, Shield, Wrench, Globe2, Layers, GitBranch,
  Cpu, Zap, Server, Cog, Terminal, Box, Gem,
  Blocks, Link2, Globe, KeyRound, Package, FileText,
  Wallet, Smartphone, Wifi, FlaskConical,
  Cable, Router, BarChart2,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { INFRA_LAYERS } from './data/infrastructureData';
import type { InfraPageType } from './types/i18n.types';
import type { InfrastructureModalProps } from './types/components.types';

/* ─── Icon map ───────────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  Database, Network, Code2, TrendingUp, ArrowLeftRight,
  Monitor, Shield, Wrench, Globe2, Layers, GitBranch,
  Cpu, Zap, Server, Cog, Terminal, Box, Gem,
  Blocks, Link2, Globe, KeyRound, Package, FileText,
  Wallet, Smartphone, Wifi, FlaskConical,
  Cable, Router, BarChart2,
  Bridge: ArrowLeftRight,
};

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const Comp = ICON_MAP[name] ?? Box;
  return <Comp className={className} aria-hidden="true" />;
}

export function InfrastructureModal({ isOpen, onClose }: InfrastructureModalProps) {
  const { t } = useLanguage();
  const pt = (t as unknown as { infrastructure_page: InfraPageType }).infrastructure_page;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  /* Label without arrow */
  const institutions = (t as unknown as { instituciones?: { btnInfraWeb?: string } }).instituciones;
  const webBtnLabel = (institutions?.btnInfraWeb ?? 'Web mode').replace(/\s*→$/, '');

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 md:p-8">
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
              className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Panel — max-w-2xl for focused reading */}
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 28, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label={pt?.hero?.title ?? 'Infrastructure'}
              className="fixed inset-x-0 top-4 bottom-0 sm:inset-x-4 sm:bottom-4 sm:top-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:top-6 md:bottom-6 md:w-full md:max-w-2xl z-[1000] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col h-full rounded-t-3xl sm:rounded-3xl bg-[var(--color-bg)] border border-[var(--color-card-border)] shadow-[0_40px_80px_-12px_rgba(0,0,0,0.55)] overflow-hidden">

                {/* ══ Header =============================================══════ */}
                <div className="relative shrink-0 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/15 via-[var(--color-surface)] to-[var(--color-accent)]/8 pointer-events-none" />
                  <div
                    className="absolute inset-0 opacity-[0.035] pointer-events-none"
                    style={{
                      backgroundImage: 'radial-gradient(var(--color-text-main) 1px, transparent 1px)',
                      backgroundSize: '22px 22px',
                    }}
                  />

                  <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-[var(--color-card-border)]">
                    <div className="flex items-center gap-4">
                      <div className="size-11 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center shadow-lg shrink-0">
                        <Wrench className="size-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-main)] tracking-tight leading-snug">
                          <span className="text-[var(--color-text-muted)] font-normal">
                            {pt?.hero?.brand ?? 'Radix'}{' '}
                          </span>
                          <span className="text-white">
                            {pt?.hero?.title ?? 'Infrastructure'}
                          </span>
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {INFRA_LAYERS.length} capas · {INFRA_LAYERS.reduce((a, l) => a + l.items.length, 0)} componentes
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href="/infrastructure"
                        className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-all"
                      >
                        <ExternalLink className="size-3.5" />
                        {webBtnLabel}
                      </Link>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="size-9 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)] border border-transparent hover:border-[var(--color-card-border)] transition-all"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ══ Body =============================================════════ */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                  {INFRA_LAYERS.map(layer => {
                    const lt = pt?.layers?.[layer.id];
                    if (!lt) return null;

                    return (
                      <div
                        key={layer.id}
                        className="rounded-2xl border border-[var(--color-card-border)] overflow-hidden bg-[var(--color-surface)]"
                      >
                        {/* Layer header */}
                        <div className="relative overflow-hidden px-5 pt-5 pb-4">
                          <div className={`absolute inset-0 bg-gradient-to-br ${layer.gradient} opacity-[0.06] pointer-events-none`} />

                          <div className="relative flex items-center gap-3 mb-3">
                            <div className={`shrink-0 size-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${layer.gradient} shadow-sm`}>
                              <Icon name={layer.icon} className="size-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${layer.gradient}`}>
                                  {lt.number}
                                </span>
                                <h3 className="text-sm font-bold text-[var(--color-text-main)] leading-none">
                                  {lt.title}
                                </h3>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)] mt-1 font-medium">
                                {lt.subtitle}
                              </p>
                            </div>
                          </div>

                          {/* Layer description */}
                          <p className="relative text-sm text-[var(--color-text-muted)] leading-relaxed pt-3 border-t border-[var(--color-card-border)]/60">
                            {lt.description}
                          </p>
                        </div>

                        {/* Items */}
                        <div className="px-4 pb-4 space-y-2.5">
                          {layer.items.map((item: { key: string; icon: string }) => {
                            const it = lt.items?.[item.key];
                            if (!it) return null;
                            return (
                              <div
                                key={item.key}
                                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-card-border)] hover:border-[var(--color-primary)]/25 transition-colors"
                              >
                                <div className={`shrink-0 size-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${layer.gradient}`}>
                                  <Icon name={item.icon} className="size-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-[var(--color-text-main)] leading-snug mb-1">
                                    {it.title}
                                  </p>
                                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                    {it.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ══ Footer =============================================══════ */}
                <div className="shrink-0 border-t border-[var(--color-card-border)] px-6 py-4 flex items-center justify-end gap-2 bg-[var(--color-surface)]/60">
                  <Link
                    href="/infrastructure"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
                  >
                    <ExternalLink className="size-4" />
                    {webBtnLabel}
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
