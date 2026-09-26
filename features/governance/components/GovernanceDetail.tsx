'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, BarChart3, Landmark, Hash, Layers, ListChecks, CalendarClock, PenLine, ExternalLink, ArrowUpRight, ArrowDownLeft, Boxes } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { votingPhase } from '../lib/governanceVotes';
import { governanceItemPath } from '../lib/paths';
import { useNow } from '../hooks/useNow';
import { fill, formatDate, LinkList, type Gv } from './VoteParts';
import { VotePanel } from './VotePanel';
import { ResultsDashboard } from './ResultsDashboard';
import { KindPill, PhasePill, type G } from './GovernanceBadges';
import { CopyButton, shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import { useCopy } from '../hooks/useCopy';
import { useItemTranslation, type TranslationResponse } from '../hooks/useItemTranslation';
import { Languages, Loader2 } from 'lucide-react';

type Tab = 'proposal' | 'results';

function Row({ icon: Icon, label, children }: { icon: typeof Hash; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2.5 border-t first:border-t-0 border-[var(--color-card-border)]">
            <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] shrink-0">
                <Icon className="size-3.5 text-[var(--color-primary)]" />{label}
            </span>
            <span className="min-w-0 text-right text-xs font-semibold text-[var(--color-text-main)] break-words">{children}</span>
        </div>
    );
}

function DetailsCard({ entry, system, g, language }: { entry: GovernanceEntry; system: GovernanceSystem; g: G; language: string }) {
    const { item, kind, id } = entry;
    const gv: Gv = g.vote ?? {};
    const { copied, copy } = useCopy();
    const link = (k: 'proposal' | 'temperature_check', target: string) => `/${language}${governanceItemPath(system.key, k, target)}`;
    return (
        <section aria-labelledby="vote-details" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5">
            <h2 id="vote-details" className="mb-2 text-sm font-bold text-[var(--color-text-main)]">{g.details || 'Vote details'}</h2>
            <Row icon={Landmark} label={g.detail_system || 'System'}>
                <a href={system.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--color-primary)]">
                    {system.name}<ExternalLink className="size-3" />
                </a>
            </Row>
            <Row icon={FileText} label={g.detail_kind || 'Type'}>
                {kind === 'proposal' ? (gv.kind_proposal || 'Formal proposal') : (gv.kind_temperature_check || 'Temperature check')}
            </Row>
            <Row icon={Hash} label={g.detail_number || 'Number'}>#{id}</Row>
            {item.parameterLabel && <Row icon={Layers} label={g.detail_parameters || 'Category'}>{item.parameterLabel}</Row>}
            {kind === 'proposal' && item.maxSelections > 1 && <Row icon={ListChecks} label={g.detail_max_options || 'Options per ballot'}>{item.maxSelections}</Row>}
            {item.start && <Row icon={CalendarClock} label={gv.starts || 'Opens'}><span suppressHydrationWarning>{formatDate(item.start, language)}</span></Row>}
            {item.deadline && <Row icon={CalendarClock} label={gv.ends || 'Closes'}><span suppressHydrationWarning>{formatDate(item.deadline, language)}</span></Row>}
            {item.author && (
                <Row icon={PenLine} label={kind === 'proposal' ? (gv.author_proposal || 'Proposed by') : (gv.author_temperature_check || 'Raised by')}>
                    <Link href={`/${language}/dashboard/account/${item.author}`} className="font-mono hover:text-[var(--color-primary)]" title={item.author}>{shortenAddress(item.author)}</Link>
                </Row>
            )}
            <Row icon={Boxes} label={g.detail_component || 'Component'}>
                <span className="inline-flex items-center gap-1 font-mono">
                    <span title={system.component}>{shortenAddress(system.component)}</span>
                    <CopyButton value={system.component} copiedAddress={copied} onCopy={copy} title={g.copy || 'Copy'} />
                </span>
            </Row>
            {kind === 'proposal' && item.temperatureCheckId && (
                <Link href={link('temperature_check', item.temperatureCheckId)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                    <ArrowDownLeft className="size-3.5" />{fill(g.from_tc || 'Comes from temperature check #{id}', { id: item.temperatureCheckId })}
                </Link>
            )}
            {kind === 'temperature_check' && item.elevatedProposalId && (
                <Link href={link('proposal', item.elevatedProposalId)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                    <ArrowUpRight className="size-3.5" />{fill(g.to_proposal || 'Moved on to formal proposal #{id}', { id: item.elevatedProposalId })}
                </Link>
            )}
        </section>
    );
}

/**
 * One vote, in two tabs: the proposal itself (text, details and the ballot to
 * vote on) and its result as a dashboard. The tab lives in the URL
 * (`?tab=results`) so either view can be shared.
 */
export function GovernanceDetail({ entry: originalEntry, system, descriptionHtml: originalHtml, g, language, serverNow, initialTranslation }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    /** Proposal text, rendered and sanitised on the server. */
    descriptionHtml: string;
    g: G;
    language: string;
    serverNow: number;
    /** Stored translation served with the page, when there is one. */
    initialTranslation: TranslationResponse | null;
}) {
    const translationQuery = useItemTranslation(originalEntry, language, initialTranslation);
    const [showOriginal, setShowOriginal] = useState(false);
    const translation = translationQuery.data?.status === 'ready' ? translationQuery.data : null;
    const translated = !!translation && !showOriginal;
    // Everything below reads the entry, so a translated copy of it translates the whole page.
    const entry: GovernanceEntry = translated ? {
        ...originalEntry,
        item: {
            ...originalEntry.item,
            title: translation.title || originalEntry.item.title,
            shortDescription: translation.shortDescription || originalEntry.item.shortDescription,
            options: originalEntry.item.options.map(o => ({ ...o, label: translation.options?.find(t => t.id === o.id)?.label || o.label })),
        },
    } : originalEntry;
    const descriptionHtml = translated && translation.descriptionHtml ? translation.descriptionHtml : originalHtml;
    const searchParams = useSearchParams();
    const [tab, setTabState] = useState<Tab>(searchParams.get('tab') === 'results' ? 'results' : 'proposal');
    const now = useNow(serverNow);
    const { item, kind, id } = entry;
    const phase = votingPhase(item, now);
    const gv: Gv = g.vote ?? {};

    // Switching tabs is purely client-side: the URL is updated for sharing
    // without a round trip to the server (Next keeps useSearchParams in sync).
    const setTab = (next: Tab) => {
        setTabState(next);
        const url = new URL(window.location.href);
        if (next === 'results') url.searchParams.set('tab', 'results'); else url.searchParams.delete('tab');
        window.history.replaceState(null, '', url);
    };
    const tabs: Array<{ key: Tab; label: string; icon: typeof FileText }> = [
        { key: 'proposal', label: kind === 'proposal' ? (g.tab_proposal || 'Proposal') : (g.tab_temperature_check || 'Temperature check'), icon: FileText },
        { key: 'results', label: g.tab_results || 'Result', icon: BarChart3 },
    ];

    return (
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-16">
            <Link href={`/${language}/governance`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                <ArrowLeft className="size-3.5" />{g.back || 'All votes'}
            </Link>

            <header className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                    <KindPill kind={kind} g={g} />
                    <PhasePill phase={phase} g={g} />
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">{system.name} · #{id}</span>
                    {item.parameterLabel && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]">{item.parameterLabel}</span>
                    )}
                </div>
                <h1 className="mt-3 text-2xl md:text-4xl font-bold leading-tight text-[var(--color-text-main)] break-words">
                    {item.title || gv.untitled || 'untitled'}
                </h1>
                {item.shortDescription && (
                    <p className="mt-3 max-w-4xl text-sm md:text-base leading-relaxed text-[var(--color-text-secondary)]">{item.shortDescription}</p>
                )}
            </header>

            {(translationQuery.data?.status === 'pending' || translation) && (
                <div className="mt-4 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
                    {translationQuery.data?.status === 'pending' ? (
                        <><Loader2 className="size-3.5 animate-spin text-[var(--color-primary)]" />{g.translating || 'Translating…'}</>
                    ) : (
                        <>
                            <Languages className="size-3.5 text-[var(--color-primary)]" />
                            {showOriginal ? (g.showing_original || 'You are viewing the original English text') : (g.translated_from || 'Automatically translated from English')}
                            <span aria-hidden>·</span>
                            <button type="button" onClick={() => setShowOriginal(v => !v)} className="font-bold text-[var(--color-primary)] hover:underline">
                                {showOriginal ? (g.show_translation || 'View translation') : (g.show_original || 'View original')}
                            </button>
                        </>
                    )}
                </div>
            )}

            <div role="tablist" aria-label={item.title ?? undefined} className="mt-6 flex gap-6 border-b border-[var(--color-card-border)]">
                {tabs.map(t => {
                    const active = tab === t.key;
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            role="tab"
                            id={`tab-${t.key}`}
                            aria-selected={active}
                            aria-controls={`panel-${t.key}`}
                            onClick={() => setTab(t.key)}
                            className={`relative flex items-center gap-2 pb-3 text-sm font-bold transition-colors ${active ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <Icon className={`size-4 ${active ? 'text-[var(--color-primary)]' : ''}`} />
                            {t.label}
                            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary)]" />}
                        </button>
                    );
                })}
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
                {tab === 'proposal' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
                        <div className="space-y-6 min-w-0 order-2 lg:order-1">
                            {descriptionHtml && (
                                <article>
                                    <h2 className="mb-4 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{g.full_text || 'Full text of the proposal'}</h2>
                                    <div className="governance-prose" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
                                </article>
                            )}
                            <LinkList links={item.links} title={gv.links || 'Learn more'} />
                        </div>
                        <aside className="space-y-4 order-1 lg:order-2 lg:sticky lg:top-24">
                            <VotePanel entry={entry} system={system} g={g} language={language} now={now} />
                            <DetailsCard entry={entry} system={system} g={g} language={language} />
                        </aside>
                    </div>
                ) : (
                    // Full width: the results box itself is the ballot.
                    <ResultsDashboard entry={entry} system={system} g={g} language={language} now={now} />
                )}
            </div>
        </div>
    );
}
