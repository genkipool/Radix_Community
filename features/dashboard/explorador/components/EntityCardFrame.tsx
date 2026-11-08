'use client';
import React, { useState, useId } from 'react';
import { AnimatePresence, m } from 'motion/react';

import { Card } from '@/components/ui/Card';
import { CloseButton } from '@/components/ui/CloseButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { PanelTabBar } from './EntityPanelShared';

/** The colour a fact's value is drawn in. */
export type FactTone = 'accent' | 'secondary' | 'primary' | 'blue' | 'green' | 'danger' | 'main';

/** Colour only, for a value drawn outside the facts row (a status in a tile). */
export const STATUS_CLASS: Record<FactTone, string> = {
    accent: 'text-[var(--color-accent)]',
    secondary: 'text-[var(--color-secondary)]',
    primary: 'text-[var(--color-primary)]',
    blue: 'text-blue-500',
    green: 'text-green-500',
    danger: 'text-[var(--color-danger)]',
    main: 'text-[var(--color-text-main)]',
};

const TONE_CLASS: Record<FactTone, string> = {
    accent: 'font-mono text-[var(--color-accent)]',
    secondary: 'font-mono text-[var(--color-secondary)]',
    primary: 'font-mono text-[var(--color-primary)]',
    blue: 'font-mono text-blue-500',
    green: 'font-mono text-green-500',
    danger: 'text-[var(--color-danger)]',
    main: 'text-[var(--color-text-main)]',
};

/** One of the headline facts under the address (up to six fit on a row). */
export interface EntityFact {
    label: string;
    value: React.ReactNode;
    tone?: FactTone;
    /** Hover text, e.g. the exact value behind a rounded one. */
    title?: string;
}

/** A tab of the expanded card. */
export interface EntityCardTab {
    key: string;
    label: string;
    tooltip?: string;
    render: () => React.ReactNode;
}

export interface EntityCardFrameProps {
    address: string;
    /** The picture in the side column: an icon or the entity's own image. */
    avatar: React.ReactNode;
    facts: EntityFact[];
    tabs: EntityCardTab[];
    isExpanded?: boolean;
    onExpand?: (address: string) => void;
    onCopy: (address: string) => void;
    copiedAddress: string | null;
    isModal?: boolean;
    closeLabel?: string;
    /** Small label at the far right of the address row (e.g. the network a card belongs to). */
    badge?: React.ReactNode;
    /** Buttons at the right of the address row. */
    actions?: React.ReactNode;
    /** Buttons right after the address's copy button (e.g. a CSV download). */
    addressActions?: React.ReactNode;
    /** Only the tab bar and the active tab, open: for a card shown inside another view that already names the entity. */
    headless?: boolean;
}

/**
 * The frame every explorer card shares: avatar, address with copy, headline
 * facts, and once expanded a tab bar over the active tab's content. It knows
 * nothing about where the data comes from, so Babylon (Gateway) and Olympia
 * (archive) cards look and behave the same.
 */
export function EntityCardFrame({
    address,
    avatar,
    facts,
    tabs,
    isExpanded,
    onExpand,
    onCopy,
    copiedAddress,
    isModal,
    closeLabel,
    badge,
    actions,
    addressActions,
    headless = false,
}: EntityCardFrameProps) {
    const instanceId = useId();
    const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? '');
    const isCopied = copiedAddress === address;
    const clickable = !isModal && !!onExpand;
    const active = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

    if (headless) {
        return (
            <div role="presentation" onClick={(e) => e.stopPropagation()} className="cursor-auto w-full">
                <PanelTabBar
                    tabs={tabs.map(({ key, label, tooltip }) => ({ key, label, tooltip }))}
                    activeTab={active?.key ?? ''}
                    onTabChange={setActiveTab}
                    layoutId={`entityTabs-${instanceId}`}
                />
                <div className="px-4 py-3 min-h-[200px]">{active?.render()}</div>
            </div>
        );
    }

    return (
        <Card
            onClick={clickable ? () => onExpand?.(address) : undefined}
            className={`p-0 shadow-md transition-all duration-300 group ${clickable ? 'cursor-pointer' : 'cursor-default'} overflow-hidden col-span-full border border-[var(--color-accent)]/30 ${isModal ? 'bg-[var(--color-bg)] h-full flex flex-col' : 'bg-[var(--color-surface)]'} ${isExpanded ? 'ring-2 ring-[var(--color-primary)]' : 'hover:shadow-lg'}`}
            innerClassName={isModal ? 'flex flex-col h-full min-h-0 flex-1' : ''}
        >
            <div className="flex flex-col sm:flex-row shrink-0">
                <div
                    aria-hidden="true"
                    className="w-full sm:w-[140px] p-4 sm:p-6 border-r shrink-0 border-b sm:border-b-0 border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-row sm:flex-col items-center gap-3 text-center relative overflow-hidden cursor-pointer self-stretch justify-center"
                >
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10" style={{ background: 'radial-gradient(circle at top, var(--color-accent), transparent)' }} />
                    <div
                        className="relative z-10 p-3 sm:p-4 rounded-2xl border-2 shadow-lg bg-[var(--color-bg)] transition-all duration-300 flex items-center justify-center border-[var(--color-accent)]"
                        style={{ boxShadow: '0 0 15px var(--color-accent)30' }}
                    >
                        {avatar}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3 sm:flex-nowrap">
                            <div className="flex items-center gap-2 overflow-hidden shrink min-w-0 flex-1 pr-2">
                                <h3
                                    className="text-xs sm:text-sm font-mono font-black text-[var(--color-text-main)] group-hover:text-[var(--color-secondary)] transition-colors truncate mr-2"
                                    title={address}
                                >
                                    {address}
                                </h3>
                                <CopyButton
                                    value={address}
                                    variant="card-inline"
                                    size="sm"
                                    forceCopied={isCopied}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopy(address);
                                    }}
                                    className="shrink-0"
                                />
                                {addressActions}
                            </div>
                            <div className="shrink-0 flex items-center gap-3 mt-1 sm:mt-0">
                                {actions}
                                {badge}
                                {isModal && onExpand && (
                                    <CloseButton
                                        onClose={() => onExpand?.(address)}
                                        title={closeLabel || 'Close'}
                                        iconSize={20}
                                        className="shrink-0 ml-1"
                                    />
                                )}
                            </div>
                        </div>

                        <div className={`grid grid-cols-2 ${facts.length > 5 ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} gap-2 sm:gap-4 text-sm mt-3 items-center`}>
                            {facts.map((fact) => (
                                <div key={fact.label} className="min-w-0">
                                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate">
                                        {fact.label}
                                    </div>
                                    <div className={`text-sm font-bold truncate ${TONE_CLASS[fact.tone ?? 'main']}`} title={fact.title}>
                                        {fact.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <m.div
                        initial={isModal ? false : { height: 0, opacity: 0 }}
                        animate={isModal ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className={`overflow-hidden bg-[var(--color-bg)] w-full border-t border-[var(--color-card-border)] ${isModal ? 'flex-1 flex flex-col min-h-0' : ''}`}
                    >
                        <div role="presentation" onClick={(e) => e.stopPropagation()} className={`cursor-auto w-full ${isModal ? 'flex-1 flex flex-col min-h-0' : ''}`}>
                            <PanelTabBar
                                tabs={tabs.map(({ key, label, tooltip }) => ({ key, label, tooltip }))}
                                activeTab={active?.key ?? ''}
                                onTabChange={setActiveTab}
                                layoutId={`entityTabs-${instanceId}`}
                            />
                            <div className={`px-4 py-3 pb-6 ${isModal ? 'flex-1 overflow-y-auto min-h-0 custom-scrollbar' : ''}`}>
                                {active?.render()}
                            </div>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
