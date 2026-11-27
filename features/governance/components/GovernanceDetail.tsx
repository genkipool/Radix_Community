'use client';

import React, { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText, BarChart3, Landmark, Hash, Layers, ListChecks, CalendarClock, PenLine, ExternalLink, ArrowUpRight, ArrowDownLeft, Boxes, Info, Target, ThumbsUp, Hourglass, Users, Scale, History } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { resolveLiveVoterCounts, votingPhase, type GovernanceElectionSpec } from '../lib/governanceVotes';
import { governanceItemPath } from '../lib/paths';
import { useNow } from '../hooks/useNow';
import { fill, formatDate, LinkList, type Gv } from './VoteParts';
import { formatDuration, formatPct, formatXrd } from '../lib/format';
import { CollapsibleCard } from './CollapsibleCard';
import { VotePanel } from './VotePanel';
import { ResultsDashboard } from './ResultsDashboard';

const TabSkeleton = () => (
    <div className="space-y-4" aria-hidden="true">
        <div className="h-28 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] animate-pulse" />
        <div className="h-72 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] animate-pulse" />
    </div>
);

const MethodsComparison = dynamic(
    () => import('./MethodsComparison').then(m => m.MethodsComparison),
    { loading: TabSkeleton },
);
const HistoricalComparison = dynamic(
    () => import('./HistoricalComparison').then(m => m.HistoricalComparison),
    { loading: TabSkeleton },
);
import { useGovernanceNav } from './GovernanceNav';
import { KindPill, PhasePill, type G } from './GovernanceBadges';
import { CopyButton, shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import { useCopy } from '../hooks/useCopy';
import { TranslationBar, useTranslatedHtml, useTranslatedList, useTranslatedText } from './BrowserTranslation';
import { JsonExportPill, useRegisterTabExport, type TabExportGetter } from './JsonExportPill';
import { useGovernanceTally } from '../hooks/useGovernanceTally';
import { ElectionCandidatesBallot, ElectionOverviewCards, ElectionVoteSidebar } from './ElectionSection';

type Tab = 'proposal' | 'results' | 'compare' | 'historical';

const tabFromParam = (value: string | null): Tab =>
    value === 'results' || value === 'compare' || value === 'historical' ? value : 'proposal';

function Row({ icon: Icon, label, hint, children }: { icon: typeof Hash; label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className={`flex items-start justify-between gap-3 py-2.5 border-t first:border-t-0 border-[var(--color-card-border)] ${hint ? 'cursor-help' : ''}`} title={hint}>
            <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] shrink-0">
                <Icon className="size-3.5 text-[var(--color-primary)]" />{label}
            </span>
            <span className="min-w-0 text-right text-xs font-semibold text-[var(--color-text-main)] break-words">{children}</span>
        </div>
    );
}

function DetailsCard({ entry, system, g, language, liveVoters }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    g: G;
    language: string;
    liveVoters?: ReadonlyArray<{ changes: number }> | null;
}) {
    const { item, kind, id } = entry;
    const gv: Gv = g.vote ?? {};
    const { copied, copy } = useCopy();
    const link = (k: 'proposal' | 'temperature_check', target: string) => `/${language}${governanceItemPath(system.key, k, target)}`;
    const { voters: votes, revotes } = resolveLiveVoterCounts(item, liveVoters);
    // What each row means, shown on hover.
    const hints = (g.detail_hints ?? {}) as Record<string, string>;
    const kindHint = kind === 'proposal' ? hints.kind_proposal : kind === 'election' ? hints.kind_election : hints.kind_temperature_check;
    const kindText = kind === 'proposal' ? (gv.kind_proposal ?? '') : kind === 'election' ? (gv.kind_election ?? '') : (gv.kind_temperature_check ?? '');
    return (
        <CollapsibleCard id="vote-details" icon={Info} title={g.details ?? ''}>
            <Row icon={Landmark} label={g.detail_system ?? ''} hint={hints.system}>
                <a href={system.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--color-primary)]">
                    {system.name}<ExternalLink className="size-3" />
                </a>
            </Row>
            <Row icon={FileText} label={g.detail_kind ?? ''} hint={kindHint}>
                {kindText}
            </Row>
            <Row icon={Hash} label={g.detail_number ?? ''} hint={hints.number}>#{id}</Row>
            {item.parameterLabel && <Row icon={Layers} label={g.detail_parameters ?? ''} hint={hints.parameters}>{item.parameterLabel}</Row>}
            {item.quorum !== null && <Row icon={Target} label={g.detail_quorum ?? ''} hint={hints.quorum}>{formatXrd(item.quorum, language)} XRD</Row>}
            {item.approvalThreshold !== null && (
                <Row icon={ThumbsUp} label={g.detail_threshold ?? ''} hint={hints.threshold}>
                    {fill(g.detail_threshold_value ?? '', { pct: formatPct(item.approvalThreshold, language) })}
                </Row>
            )}
            {kind === 'proposal' && item.maxSelections > 1 && <Row icon={ListChecks} label={g.detail_max_options ?? ''} hint={hints.max_options}>{item.maxSelections}</Row>}
            {item.start && item.deadline && <Row icon={Hourglass} label={g.detail_duration ?? ''} hint={hints.duration}>{formatDuration(item.deadline - item.start, language)}</Row>}
            {item.start && <Row icon={CalendarClock} label={gv.starts ?? ''} hint={hints.starts}><span suppressHydrationWarning>{formatDate(item.start, language)}</span></Row>}
            {item.deadline && <Row icon={CalendarClock} label={gv.ends ?? ''} hint={hints.ends}><span suppressHydrationWarning>{formatDate(item.deadline, language)}</span></Row>}
            {votes !== null && (
                <Row icon={Users} label={g.detail_voters ?? ''} hint={hints.voters}>
                    {revotes
                        ? fill(g.detail_voters_value ?? '', { n: votes.toLocaleString(language), changed: revotes.toLocaleString(language) })
                        : votes.toLocaleString(language)}
                </Row>
            )}
            {item.author && (
                <Row icon={PenLine} label={kind === 'proposal' ? (gv.author_proposal ?? '') : (gv.author_temperature_check ?? '')} hint={kind === 'proposal' ? hints.author_proposal : hints.author_temperature_check}>
                    <span className="inline-flex items-center gap-1 font-mono">
                        <Link href={`/${language}/dashboard/account/${item.author}`} className="hover:text-[var(--color-primary)]" title={item.author}>{shortenAddress(item.author)}</Link>
                        <CopyButton value={item.author} copiedAddress={copied} onCopy={copy} title={g.copy ?? ''} />
                    </span>
                </Row>
            )}
            <Row icon={Boxes} label={g.detail_component ?? ''} hint={hints.component}>
                <span className="inline-flex items-center gap-1 font-mono">
                    <span title={system.component}>{shortenAddress(system.component)}</span>
                    <CopyButton value={system.component} copiedAddress={copied} onCopy={copy} title={g.copy ?? ''} />
                </span>
            </Row>
            {(kind === 'proposal' || kind === 'election') && item.temperatureCheckId && (
                <Link href={link('temperature_check', item.temperatureCheckId)} title={hints.from_tc} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline">
                    <ArrowDownLeft className="size-3.5" />{fill(g.from_tc ?? '', { id: item.temperatureCheckId })}
                </Link>
            )}
            {kind === 'temperature_check' && item.elevatedProposalId && (
                <Link href={link('proposal', item.elevatedProposalId)} title={hints.to_proposal} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] hover:underline">
                    <ArrowUpRight className="size-3.5" />{fill(g.to_proposal ?? '', { id: item.elevatedProposalId })}
                </Link>
            )}
        </CollapsibleCard>
    );
}

function CandidatesSection({ election, g }: { election: GovernanceElectionSpec; g: G }) {
    const descriptions = useTranslatedList(election.candidates.map(c => c.description ?? ''));
    const metaText = election.roleId && election.seatCount !== null
        ? fill(g.candidates_meta ?? '', { role: election.roleId, seats: String(election.seatCount) })
        : election.seatCount !== null
            ? fill(g.candidates_meta_no_role ?? '', { seats: String(election.seatCount) })
            : null;

    return (
        <section className="pt-6 border-t border-[var(--color-card-border)] space-y-4">
            <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-text-main)]">
                    <Users className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                    <span>{g.candidates_title ?? ''} ({election.candidates.length})</span>
                </h2>
                {metaText && (
                    <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {metaText}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {election.candidates.map((candidate, idx) => {
                    const desc = descriptions[idx] ?? candidate.description;
                    return (
                        <div
                            key={`${candidate.id}-${candidate.displayName}`}
                            className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-4 flex flex-col justify-between gap-2.5"
                        >
                            <div className="space-y-1">
                                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                    <h3 className="text-sm font-bold text-[var(--color-text-main)]">
                                        {candidate.displayName}
                                    </h3>
                                    {candidate.reference && (
                                        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                                            {candidate.reference}
                                        </span>
                                    )}
                                </div>
                                {desc && (
                                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                                        {desc}
                                    </p>
                                )}
                            </div>

                            {candidate.links.length > 0 && (
                                <div className="flex flex-wrap gap-3 pt-1">
                                    {candidate.links.map((href, linkIdx) => (
                                        <a
                                            key={href}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                                        >
                                            <span>
                                                {g.candidate_profile ?? ''}
                                                {candidate.links.length > 1 ? ` #${linkIdx + 1}` : ''}
                                            </span>
                                            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

/**
 * One vote, in three tabs: the proposal itself (text, details and the ballot
 * to vote on), its result as a dashboard, and the same ballots counted with
 * other voting methods. The tab lives in the URL (`?tab=results`,
 * `?tab=compare`) so any view can be shared.
 */
export function GovernanceDetail({ entry: originalEntry, system, descriptionHtml: originalHtml, g: gProp, language, serverNow }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    /** Proposal text, rendered and sanitised on the server. */
    descriptionHtml: string;
    /** Optional dictionary override (defaults to the layout shell's shared context). */
    g?: G;
    language: string;
    serverNow: number;
}) {
    const { entries: allEntries, g: navG } = useGovernanceNav();
    const g = gProp ?? navG;
    // Translated on the reader's device when the browser can; the original otherwise.
    const { item: original } = originalEntry;
    const title = useTranslatedText(original.title);
    const shortDescription = useTranslatedText(original.shortDescription);
    // Candidate names in elections are proper nouns and must never be translated.
    const isElection = originalEntry.kind === 'election';
    const optionLabels = useTranslatedList(isElection ? [] : original.options.map(o => o.label));
    const descriptionHtml = useTranslatedHtml(originalHtml);
    // Everything below reads the entry, so a translated copy of it translates the whole page.
    const entry: GovernanceEntry = {
        ...originalEntry,
        item: {
            ...original,
            title,
            shortDescription,
            options: isElection
                ? original.options
                : original.options.map((o, i) => ({ ...o, label: optionLabels[i] ?? o.label, sourceLabel: o.label })),
        },
    };
    const searchParams = useSearchParams();
    const [tab, setTabState] = useState<Tab>(tabFromParam(searchParams.get('tab')));
    const [grades, setGrades] = useState<Record<number, number>>({});
    const exportGetterRef = useRef<TabExportGetter | null>(null);
    const registerExport = (getter: TabExportGetter | null) => {
        exportGetterRef.current = getter;
    };
    const now = useNow(serverNow);
    const { item, kind, id } = entry;
    const phase = votingPhase(item, now);
    const gv: Gv = g.vote ?? {};
    const electionTally = useGovernanceTally(
        { component: system.component, kind, itemId: id, voters: true },
        system.network,
        kind === 'election',
    );
    const electionData = electionTally.data?.electionData ?? null;

    useRegisterTabExport(tab === 'proposal' ? registerExport : undefined, () => ({
        tab: 'proposal',
        exportedAt: new Date().toISOString(),
        system: {
            key: system.key,
            name: system.name,
            network: system.network,
            component: system.component,
            website: system.website,
        },
        entry: {
            kind,
            id,
            phase,
            item,
            descriptionHtml,
            ...(electionData ? { electionData } : {}),
        },
    }));

    // Switching tabs is purely client-side: the URL is updated for sharing
    // without a round trip to the server (Next keeps useSearchParams in sync).
    const setTab = (next: Tab) => {
        setTabState(next);
        const url = new URL(window.location.href);
        if (next === 'proposal') url.searchParams.delete('tab'); else url.searchParams.set('tab', next);
        window.history.replaceState(null, '', url);
    };
    const tabs: Array<{ key: Tab; label: string; icon: typeof FileText }> = [
        {
            key: 'proposal',
            label: kind === 'proposal'
                ? (g.tab_proposal ?? '')
                : kind === 'election'
                    ? (g.tab_election ?? '')
                    : (g.tab_temperature_check ?? ''),
            icon: FileText,
        },
        { key: 'results', label: g.tab_results ?? '', icon: BarChart3 },
        { key: 'compare', label: g.tab_compare ?? '', icon: Scale },
        { key: 'historical', label: (g.tab_historical || g.tab_compare) ?? '', icon: History },
    ];

    return (
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-10 pt-8 pb-16">
            <Link href={`/${language}/governance`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                <ArrowLeft className="size-3.5" />{g.back ?? ''}
            </Link>

            <header className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                    <KindPill kind={kind} g={g} />
                    <PhasePill phase={phase} g={g} />
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">{system.name} · #{id}</span>
                    {item.parameterLabel && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]">{item.parameterLabel}</span>
                    )}
                    <JsonExportPill
                        getData={() => exportGetterRef.current?.() ?? null}
                        filename={`${system.key}-${kind}-${id}-${tab}.json`}
                        g={g}
                    />
                    <TranslationBar g={g} />
                </div>
                <h1 className="mt-3 text-2xl md:text-4xl font-bold leading-tight text-[var(--color-text-main)] break-words">
                    {(item.title || gv.untitled) ?? ''}
                </h1>
                {item.shortDescription && (
                    <p className="mt-3 max-w-4xl text-sm md:text-base leading-relaxed text-[var(--color-text-secondary)]">{item.shortDescription}</p>
                )}
            </header>

            <div role="tablist" aria-label={item.title ?? undefined} className="mt-6 flex gap-4 sm:gap-6 border-b border-[var(--color-card-border)] overflow-x-auto no-scrollbar">
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
                            className={`relative shrink-0 flex items-center gap-2 pb-3 text-sm font-bold transition-colors ${active ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
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
                            {kind === 'election' && item.election && (
                                <ElectionOverviewCards
                                    election={item.election}
                                    electionData={electionData}
                                    quorum={item.quorum}
                                    g={g}
                                    language={language}
                                />
                            )}
                            {descriptionHtml && (
                                <article>
                                    <h2 className="mb-4 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{g.full_text ?? ''}</h2>
                                    <div className="governance-prose" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
                                </article>
                            )}
                            {item.election && item.election.candidates.length > 0 && (
                                kind === 'election' ? (
                                    <ElectionCandidatesBallot
                                        election={item.election}
                                        electionData={electionData}
                                        voters={electionTally.data?.voters}
                                        grades={grades}
                                        onGrade={(cid, grade) => setGrades(prev => ({ ...prev, [cid]: grade }))}
                                        canGrade={phase === 'open'}
                                        g={g}
                                        language={language}
                                    />
                                ) : (
                                    <CandidatesSection election={item.election} g={g} />
                                )
                            )}
                            <LinkList links={item.links} title={gv.links ?? ''} />
                        </div>
                        <aside className="space-y-4 order-1 lg:order-2 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto no-scrollbar lg:pb-2">
                            {kind === 'election' ? (
                                <ElectionVoteSidebar
                                    entry={entry}
                                    system={system}
                                    electionData={electionData}
                                    voters={electionTally.data?.voters}
                                    votersLoading={electionTally.isLoading}
                                    grades={grades}
                                    g={g}
                                    language={language}
                                    now={now}
                                />
                            ) : (
                                <VotePanel entry={entry} system={system} g={g} language={language} now={now} />
                            )}
                            <DetailsCard entry={entry} system={system} g={g} language={language} liveVoters={electionTally.data?.voters} />
                        </aside>
                    </div>
                ) : tab === 'results' ? (
                    // Full width: the results box itself is the ballot.
                    <ResultsDashboard entry={entry} system={system} g={g} language={language} now={now} onRegisterExport={registerExport} />
                ) : tab === 'compare' ? (
                    <MethodsComparison entry={entry} system={system} g={g} language={language} now={now} onRegisterExport={registerExport} />
                ) : (
                    <HistoricalComparison entries={allEntries.length ? allEntries : [entry]} g={g} language={language} now={now} onRegisterExport={registerExport} />
                )}
            </div>
        </div>
    );
}
