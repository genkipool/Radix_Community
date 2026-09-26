'use client';

import React, { useState } from 'react';
import { Landmark, Vote, Users, Layers, Search, Thermometer, FileText, BadgeCheck } from 'lucide-react';
import { ContentHero } from '@/components/layout/ContentHero';
import { GOVERNANCE_SYSTEMS } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { sortEntries, matchesQuery } from '../lib/entries';
import { uniqueVoters, votingPhase, type GovernanceItemKind, type VotingPhase } from '../lib/governanceVotes';
import { useNow } from '../hooks/useNow';
import { fill } from './VoteParts';
import { GovernanceCard } from './GovernanceCard';
import type { G } from './GovernanceBadges';

type StatusFilter = 'all' | VotingPhase;
type KindFilter = 'all' | GovernanceItemKind;

function Segmented<T extends string>({ label, value, options, onChange }: {
    label: string;
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (v: T) => void;
}) {
    return (
        <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-1">
            {options.map(o => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${value === o.value
                        ? 'bg-[var(--color-card-bg)] text-[var(--color-primary)] shadow-sm'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Vote; value: string; label: string }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4">
            <span className="grid place-items-center size-11 rounded-xl bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-secondary)]/15 text-[var(--color-primary)] shrink-0">
                <Icon className="size-5" />
            </span>
            <span className="min-w-0">
                <span className="block text-2xl font-black font-mono text-[var(--color-text-main)] leading-none">{value}</span>
                <span className="block mt-1 text-xs text-[var(--color-text-muted)]">{label}</span>
            </span>
        </div>
    );
}

const STEP_ICONS = [Thermometer, FileText, BadgeCheck];

/**
 * Landing of the governance section: what it is, how a decision is made, and
 * every vote as a filterable grid (the only list on phones, where the sidebar
 * is hidden).
 */
export function GovernanceOverview({ entries, g, language, serverNow }: {
    entries: GovernanceEntry[];
    g: G;
    language: string;
    serverNow: number;
}) {
    const now = useNow(serverNow);
    const [status, setStatus] = useState<StatusFilter>('all');
    const [kind, setKind] = useState<KindFilter>('all');
    const [system, setSystem] = useState<string>('all');
    const [query, setQuery] = useState('');

    const openCount = entries.filter(e => votingPhase(e.item, now) === 'open').length;
    const totalVoters = entries.reduce((sum, e) => sum + (uniqueVoters(e.item) ?? 0), 0);
    const visible = sortEntries(entries, now).filter(e =>
        (status === 'all' || votingPhase(e.item, now) === status)
        && (kind === 'all' || e.kind === kind)
        && (system === 'all' || e.systemKey === system)
        && matchesQuery(e, query));
    const steps = (g.how_steps ?? []) as Array<{ title: string; text: string }>;

    return (
        <ContentHero
            brandName=""
            title={g.hero_title || 'Radix Governance'}
            heroPadding="pt-12 pb-10"
            badge={{ icon: <Landmark className="size-4 text-[var(--color-primary)]" />, text: g.hero_badge || 'On-ledger governance' }}
            subtitle={g.hero_subtitle}
        >
            <div className="max-w-[1500px] mx-auto w-full px-4 sm:px-6 lg:px-12 pb-16 space-y-10">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Stat icon={Vote} value={openCount.toLocaleString(language)} label={g.stats_open || 'Open votes'} />
                    <Stat icon={Layers} value={entries.length.toLocaleString(language)} label={g.stats_total || 'Votes in total'} />
                    <Stat icon={Users} value={totalVoters.toLocaleString(language)} label={g.stats_voters || 'Votes cast'} />
                </div>

                {steps.length > 0 && (
                    <section aria-labelledby="governance-how" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 md:p-6">
                        <h2 id="governance-how" className="text-lg font-bold text-[var(--color-text-main)]">{g.how_title}</h2>
                        <ol className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {steps.map((step, i) => {
                                const Icon = STEP_ICONS[i] ?? BadgeCheck;
                                return (
                                    <li key={step.title} className="flex gap-3">
                                        <span className="grid place-items-center size-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] shrink-0">
                                            <Icon className="size-5" />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-bold text-[var(--color-text-main)]">{step.title}</span>
                                            <span className="block mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{step.text}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                )}

                <section aria-label={g.results_count ? fill(g.results_count, { n: String(visible.length) }) : undefined} className="space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                        <div className="flex flex-wrap gap-2">
                            <Segmented<StatusFilter>
                                label={g.filter_status || 'Status'}
                                value={status}
                                onChange={setStatus}
                                options={[
                                    { value: 'all', label: g.status_all || 'All' },
                                    { value: 'open', label: g.status_open || 'Open' },
                                    { value: 'upcoming', label: g.status_upcoming || 'Upcoming' },
                                    { value: 'closed', label: g.status_closed || 'Closed' },
                                ]}
                            />
                            <Segmented<KindFilter>
                                label={g.filter_kind || 'Type'}
                                value={kind}
                                onChange={setKind}
                                options={[
                                    { value: 'all', label: g.kind_all || 'All' },
                                    { value: 'proposal', label: g.kind_proposal || 'Proposals' },
                                    { value: 'temperature_check', label: g.kind_temperature_check || 'Temperature checks' },
                                ]}
                            />
                            {GOVERNANCE_SYSTEMS.length > 1 && (
                                <Segmented<string>
                                    label={g.filter_system || 'System'}
                                    value={system}
                                    onChange={setSystem}
                                    options={[{ value: 'all', label: g.system_all || 'All' }, ...GOVERNANCE_SYSTEMS.map(s => ({ value: s.key, label: s.name }))]}
                                />
                            )}
                        </div>
                        <label className="relative xl:ml-auto xl:w-72">
                            <span className="sr-only">{g.search_placeholder}</span>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                            <input
                                type="search"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={g.search_placeholder || 'Search by title'}
                                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-sm text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </label>
                    </div>

                    <p className="text-xs text-[var(--color-text-muted)]">{fill(g.results_count || '{n} votes', { n: visible.length.toLocaleString(language) })}</p>

                    {visible.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                            {visible.map(e => (
                                <GovernanceCard key={`${e.systemKey}-${e.kind}-${e.id}`} entry={e} g={g} now={now} language={language} />
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-2xl border border-dashed border-[var(--color-card-border)] p-10 text-center text-sm text-[var(--color-text-muted)]">
                            {entries.length === 0 ? (g.load_error || 'The ledger could not be read right now.') : (g.empty || 'No votes match these filters.')}
                        </p>
                    )}

                    <p className="text-[11px] text-[var(--color-text-muted)]">{g.sources}</p>
                </section>
            </div>
        </ContentHero>
    );
}
