'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, BookOpen, HeartHandshake, Shield, Rocket, Code, Zap, Globe, Vote, MessageCircle, Github, X } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { GlowBlob } from '@/components/ui/GlowBlob';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Portal } from '@/components/ui/Portal';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { AnimatePresence, motion } from 'motion/react';
import type { BaseSectionProps } from '../../types';

const card = "rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] p-5 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden";

export default function Community({ t }: BaseSectionProps) {
    const [selectedImage, setSelectedImage] = useState<{ src: string, alt: string } | null>(null);

    return (
        <section id="community" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
            <GlowBlob color="var(--color-primary)" position="top-left" size={400} opacity={0.2} blur={120} />
            <GlowBlob color="var(--color-secondary)" position="bottom-right" size={400} opacity={0.2} blur={120} />

            <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">

                <SectionHeader
                    icon={<Users size={14} />}
                    badge={t.community.badge}
                    title={t.community.title_line1}
                    titleAccent={t.community.title_line2}
                    subtitle={t.community.subtitle}
                />


                {/* ═══════ MASONRY GRID (4-col) ═══════ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">

                    {/* ── ROW 1: 4 event cards ── */}
                    <FadeIn delay={0} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Vote size={16} className="text-[var(--color-primary)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-primary)]">{t.community.ev1_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ev1_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ev1_p}</p>
                    </FadeIn>

                    <FadeIn delay={0.05} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Code size={16} className="text-[var(--color-secondary)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-secondary)]">{t.community.ev2_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ev2_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ev2_p}</p>
                    </FadeIn>

                    <FadeIn delay={0.1} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Globe size={16} className="text-[var(--color-accent)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-accent)]">{t.community.ev3_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ev3_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ev3_p}</p>
                    </FadeIn>

                    <FadeIn delay={0.15} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Rocket size={16} className="text-[var(--color-primary)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-primary)]">{t.community.ev4_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ev4_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ev4_p}</p>
                    </FadeIn>


                    {/* ── ROW 2: 1 small + 1 wide (Dan card 1 with photo) + 1 small ── */}
                    <FadeIn delay={0.05} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={16} className="text-[var(--color-secondary)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-secondary)]">{t.community.ev5_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ev5_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ev5_p}</p>
                    </FadeIn>

                    {/* WIDE CARD: Dan Hughes Part 1 (spans 2 cols) */}
                    <FadeIn delay={0.1} className={`${card} col-span-2 flex flex-col sm:flex-row gap-5`}>
                        <div
                            className="relative sm:w-40 h-40 shrink-0 rounded-xl overflow-hidden bg-[var(--color-bg-alt)] cursor-pointer group/image"
                            onClick={() => setSelectedImage({ src: "/images/Dan_Hughes_1.webp", alt: t.community.danFounderAlt || "Dan Hughes" })}
                        >
                            <Image 
                                src="/images/Dan_Hughes_1.webp" 
                                alt={t.community.danFounderAlt || "Dan Hughes"} 
                                fill 
                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 400px" 
                                style={{ objectFit: 'cover' }} 
                                className="grayscale group-hover/image:grayscale-0 group-hover/image:scale-110 transition-all duration-700" 
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-primary)] mb-1 block">{t.community.ch1_badge}</span>
                            <h3 className="text-base font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ch1_title}</h3>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-2">{t.community.ch1_p1}</p>
                            <p className="text-xs text-[var(--color-text-main)] leading-relaxed font-medium">{t.community.ch1_p2}</p>
                        </div>
                    </FadeIn>

                    <FadeIn delay={0.15} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Shield size={16} className="text-[var(--color-accent)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-accent)]">{t.community.ev6_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ev6_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ev6_p}</p>
                    </FadeIn>


                    {/* ── ROW 3: 1 small + 1 wide (Dan card 2 with photo) + 1 small ── */}
                    <FadeIn delay={0.05} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Shield size={16} className="text-[var(--color-primary)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-primary)]">{t.community.ch2_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ch2_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ch2_p4}</p>
                    </FadeIn>

                    {/* WIDE CARD: Dan Hughes Part 2 — Tragedy (spans 2 cols) */}
                    <FadeIn delay={0.1} className={`${card} col-span-2 flex flex-col sm:flex-row gap-5`}>
                        <div
                            className="relative sm:w-40 h-40 shrink-0 rounded-xl overflow-hidden bg-[var(--color-bg-alt)] cursor-pointer group/image"
                            onClick={() => setSelectedImage({ src: "/images/Dan_Hughes_2.webp", alt: t.community.danWorkingAlt || "Dan Hughes working" })}
                        >
                            <Image 
                                src="/images/Dan_Hughes_2.webp" 
                                alt={t.community.danWorkingAlt || "Dan Hughes working"} 
                                fill 
                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 400px" 
                                style={{ objectFit: 'cover' }} 
                                className="opacity-60 group-hover/image:opacity-100 group-hover/image:scale-110 transition-all duration-700" 
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-secondary)] mb-1 block">{t.community.ch3_badge}</span>
                            <h3 className="text-base font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ch3_title}</h3>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-2">{t.community.ch3_p2}</p>
                            <p className="text-xs text-[var(--color-primary)] italic leading-relaxed font-medium">{t.community.ch3_p3}</p>
                        </div>
                    </FadeIn>

                    <FadeIn delay={0.15} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Shield size={16} className="text-[var(--color-accent)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-accent)]">{t.community.ch5_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ch5_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ch5_p1}</p>
                    </FadeIn>


                    {/* ── ROW 4: 4 event cards ── */}
                    <FadeIn delay={0} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Rocket size={16} className="text-[var(--color-secondary)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-secondary)]">{t.community.ch4_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ch4_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ch4_p1}</p>
                    </FadeIn>

                    <FadeIn delay={0.05} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={16} className="text-[var(--color-primary)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-primary)]">{t.community.ch4_vs_title}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.ch4_vs_subtitle}</h3>
                        <ul className="space-y-2 text-xs text-[var(--color-text-muted)]">
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-card-border)] shrink-0" />{t.community.ch4_vs_swift}</li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-card-border)] shrink-0" />{t.community.ch4_vs_visa}</li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-card-border)] shrink-0" />{t.community.ch4_vs_sol}</li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-card-border)] shrink-0" />{t.community.ch4_vs_eth}</li>
                            <li className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-card-border)] shrink-0" />{t.community.ch4_vs_paypal}</li>
                            <li className="flex items-start gap-2 text-[var(--color-text-main)] font-semibold"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />{t.community.ch4_vs_radix}</li>
                        </ul>
                    </FadeIn>

                    <FadeIn delay={0.1} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Shield size={16} className="text-[var(--color-accent)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-accent)]">{t.community.row4c3_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.row4c3_title}</h3>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{t.community.ch2_p2}</p>
                    </FadeIn>

                    <FadeIn delay={0.15} className={card}>
                        <div className="flex items-center gap-2 mb-3">
                            <Code size={16} className="text-[var(--color-secondary)]" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-shadow-soft text-[var(--color-secondary)]">{t.community.row4c4_badge}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-main)] mb-2 leading-snug">{t.community.row4c4_title}</h3>
                        <p className="text-xs text-[var(--color-text-main)] font-medium leading-relaxed">{t.community.ch5_p2}</p>
                    </FadeIn>

                </div>


                {/* ═══════ INVESTOR / DEV CTA TEXT ═══════ */}
                <FadeIn delay={0.1} className="mt-16 max-w-4xl mx-auto text-center space-y-6">
                    <h3 className="text-2xl font-bold text-[var(--color-text-main)]">{t.community.invest_title}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{t.community.invest_p}</p>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{t.community.dev_p}</p>
                </FadeIn>


                {/* ═══════ CTA BUTTONS: all in one line ═══════ */}
                <FadeIn delay={0.15} className="mt-12 pt-10 border-t border-[var(--color-card-border)]">
                    <div className="flex flex-wrap justify-center items-center gap-4">
                        <Link href="#donate" className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white font-bold text-sm hover:scale-[1.03] transition-all overflow-hidden shadow-[0_0_30px_rgba(56,189,248,0.3)]">
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <HeartHandshake size={18} className="relative z-10" />
                            <span className="relative z-10">{t.community.donate}</span>
                        </Link>
                        <Link href="#crowdfunding" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-main)] font-bold text-sm hover:text-[var(--color-primary)] transition-all border border-[var(--color-card-border)] shadow">
                            <Users size={18} />
                            {t.community.crowdfund}
                        </Link>
                        <Link href="/blog" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-main)] font-bold text-sm hover:text-[var(--color-secondary)] transition-all border border-[var(--color-card-border)] shadow">
                            <BookOpen size={18} />
                            {t.community.blog}
                        </Link>
                        <Link href="/forum" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-main)] font-bold text-sm hover:text-[var(--color-primary)] transition-all border border-[var(--color-card-border)] shadow">
                            <MessageCircle size={18} />
                            {t.community.forum}
                        </Link>
                        <a href="https://t.me/radix_dlt" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-main)] font-bold text-sm hover:text-[#229ED9] transition-all border border-[var(--color-card-border)] shadow">
                            <MessageCircle size={18} />
                            {t.community.telegram}
                        </a>
                        <a href="https://github.com/radixdlt" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-main)] font-bold text-sm hover:text-[var(--color-text-main)] transition-all border border-[var(--color-card-border)] shadow">
                            <Github size={18} />
                            {t.community.github}
                        </a>
                        <a href="https://x.com/radixdlt" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[var(--color-surface)] text-[var(--color-text-main)] font-bold text-sm hover:text-[var(--color-text-main)] transition-all border border-[var(--color-card-border)] shadow">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                            @radixdlt
                        </a>
                    </div>
                </FadeIn>

            </div>

            <AnimatePresence>
                {selectedImage && (
                    <Portal>
                        <ModalOverlay onClose={() => setSelectedImage(null)} blur="md" />
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center pointer-events-auto"
                            >
                                <button
                                    onClick={() => setSelectedImage(null)}
                                    className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
                                >
                                    <X size={32} />
                                </button>
                                <div className="rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black/40">
                                    <Image
                                        src={selectedImage.src}
                                        alt={selectedImage.alt || "Dan Hughes"}
                                        width={1200}
                                        height={800}
                                        style={{ width: '100%', height: 'auto' }}
                                        className="object-contain max-h-[80vh]"
                                        priority
                                    />
                                    <div className="p-4 bg-black/60 backdrop-blur-sm border-t border-white/10">
                                        <p className="text-white text-sm font-medium text-center">{selectedImage.alt || "Dan Hughes"}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </Portal>
                )}
            </AnimatePresence>
        </section>
    );
}
