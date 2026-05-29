'use client';

import { motion, AnimatePresence } from 'motion/react';
import { X, Building2, Code2, FlaskConical, Users } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { useLanguage } from '@/context/LanguageContext';
import { CommunityDictionary } from '../types/i18n.types';

interface RadixInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SECTION_ICONS = [Building2, Code2, FlaskConical, Users];
const SECTION_GRADIENTS = [
    'from-blue-600 to-cyan-500',
    'from-violet-600 to-fuchsia-500',
    'from-emerald-500 to-teal-400',
    'from-amber-500 to-orange-400',
];


function buildSections(m: CommunityDictionary['modal']) {
    return [
        {
            id: 'foundation',
            title: m.s1_title,
            content: [
                { subtitle: m.s1_rtjl_sub, body: m.s1_rtjl_body },
                { subtitle: m.s1_role_sub, body: m.s1_role_body },
                { subtitle: m.s1_strategy_sub, body: m.s1_strategy_body },
            ],
        },
        {
            id: 'rdxworks',
            title: m.s2_title,
            content: [
                { subtitle: m.s2_split_sub, body: m.s2_split_body },
                { subtitle: m.s2_cease_sub, body: m.s2_cease_body },
            ],
        },
        {
            id: 'labs',
            title: m.s3_title,
            content: [
                { subtitle: m.s3_origin_sub, body: m.s3_origin_body },
                { subtitle: m.s3_tech_sub, body: m.s3_tech_body },
            ],
        },
        {
            id: 'community',
            title: m.s4_title,
            content: [
                { subtitle: m.s4_radvocates_sub, body: m.s4_radvocates_body },
                { subtitle: m.s4_defi_sub, body: m.s4_defi_body },
                { subtitle: m.s4_transition_sub, body: m.s4_transition_body },
            ],
        },
    ];
}

export function RadixInfoModal({ isOpen, onClose }: RadixInfoModalProps) {
    const { t: dict } = useLanguage();
    const t = dict.community_transparency as unknown as CommunityDictionary;
    const m = t.modal;
    const sections = buildSections(m);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <ModalOverlay onClose={onClose} blur="md" />
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.97 }}
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                        className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl z-50 overflow-hidden rounded-3xl shadow-2xl flex flex-col"
                        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-card-border)' }}
                    >
                        {/* Header */}
                        <div className="shrink-0 px-8 pt-8 pb-6 relative"
                            style={{ borderBottom: '1px solid var(--color-card-border)' }}>
                            <div className="pr-10">
                                <p className="text-xs font-semibold uppercase tracking-widest mb-2"
                                    style={{ color: 'var(--color-primary)' }}>
                                    {m.state_label}
                                </p>
                                <h2 className="text-2xl md:text-3xl font-bold leading-tight"
                                    style={{ color: 'var(--color-text-main)' }}>
                                    {m.title}
                                    <span className="ml-2 text-white">
                                        {m.title_accent}
                                    </span>
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                                    {m.subtitle}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="absolute top-7 right-7 size-9 flex items-center justify-center rounded-full transition-all duration-200"
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', color: 'var(--color-text-muted)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-main)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; }}
                                aria-label="Close"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6" style={{ scrollbarWidth: 'thin' }}>
                            {sections.map((section, idx) => {
                                const Icon = SECTION_ICONS[idx];
                                return (
                                    <motion.div
                                        key={section.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + idx * 0.07, duration: 0.3 }}
                                        className="rounded-2xl overflow-hidden"
                                        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
                                    >
                                        <div className="px-5 py-4 flex items-center gap-3"
                                            style={{ borderBottom: '1px solid var(--color-card-border)' }}>
                                            <div className={`size-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${SECTION_GRADIENTS[idx]} shrink-0`}>
                                                <Icon className="size-4 text-white" />
                                            </div>
                                            <h3 className="font-semibold text-sm leading-tight"
                                                style={{ color: 'var(--color-text-main)' }}>
                                                {idx + 1}. {section.title}
                                            </h3>
                                        </div>
                                        <div className="px-5 py-4 space-y-4">
                                            {section.content.map((item, i) => (
                                                <div key={`content-${i}`}>
                                                    <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide"
                                                        style={{ color: 'var(--color-primary)' }}>
                                                        {item.subtitle}
                                                    </p>
                                                    <p className="text-sm leading-relaxed"
                                                        style={{ color: 'var(--color-text-muted)' }}>
                                                        {item.body}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-8 py-5 flex items-center justify-between gap-4"
                            style={{ borderTop: '1px solid var(--color-card-border)', background: 'var(--color-surface)' }}>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {m.contribute_prompt}{' '}
                                <a href="https://developers.radixdlt.com" target="_blank" rel="noopener noreferrer"
                                    className="font-semibold hover:underline" style={{ color: 'var(--color-primary)' }}>
                                    {m.contribute_link_text}
                                </a>
                            </p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                                style={{ background: 'var(--color-primary)', color: '#fff' }}
                            >
                                {m.close_btn}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
