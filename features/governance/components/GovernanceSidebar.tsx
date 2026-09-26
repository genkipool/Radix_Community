'use client';

import React, { useState } from 'react';
import { useLinkStatus } from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CircleDot, Clock, Lock, FileText, Thermometer } from 'lucide-react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { SidebarGraphic } from '@/components/ui/SidebarGraphic';
import { SearchBar } from '@/components/ui/SearchBar';
import { SidebarControls } from '@/components/ui/SidebarControls';
import { SidebarCard, type SidebarCardItem } from '@/components/ui/SidebarCard';
import type { GovernanceEntry } from '../types';
import { groupByPhase, matchesQuery, PHASE_ORDER, entryKey } from '../lib/entries';
import { governanceItemPath } from '../lib/paths';
import type { VotingPhase } from '../lib/governanceVotes';
import { useNow } from '../hooks/useNow';
import { useTranslatedList } from './BrowserTranslation';
import type { G } from './GovernanceBadges';

function ItemIcon({ kind, selected }: { kind: 'proposal' | 'temperature_check'; selected: boolean }) {
    const { pending } = useLinkStatus();
    const Icon = kind === 'proposal' ? FileText : Thermometer;
    return (
        <span className={`grid place-items-center size-8 rounded-lg transition-colors ${selected
            ? 'bg-[var(--color-bg)]/20 text-[var(--color-bg)]'
            : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'}`}
        >
            <Icon className={`size-4 ${pending ? 'animate-pulse' : ''}`} />
        </span>
    );
}

const GROUP_STYLE: Record<VotingPhase, { icon: React.ReactNode; gradient: string }> = {
    open: { icon: <CircleDot className="size-5" />, gradient: 'from-emerald-500 to-teal-400' },
    upcoming: { icon: <Clock className="size-5" />, gradient: 'from-sky-500 to-indigo-400' },
    closed: { icon: <Lock className="size-5" />, gradient: 'from-slate-500 to-slate-400' },
    unknown: { icon: <Lock className="size-5" />, gradient: 'from-slate-500 to-slate-400' },
};

/**
 * Every vote, grouped by open / upcoming / closed. Items are real links (one
 * page per vote), so the sidebar survives navigation inside the section.
 */
export function GovernanceSidebar({ entries, g, language, serverNow }: {
    entries: GovernanceEntry[];
    g: G;
    language: string;
    serverNow: number;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const now = useNow(serverNow);
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState<Set<VotingPhase>>(new Set(PHASE_ORDER));
    const [autoCollapse, setAutoCollapse] = useState(false);
    // Marks the clicked item at once; the route catches up behind it.
    const [pending, setPending] = useState<{ path: string; from: string } | null>(null);
    const activePath = pending && pending.from === pathname ? pending.path : pathname;

    const titles = useTranslatedList(entries.map(e => e.item.title ?? ''));
    const titleOf = new Map(entries.map((e, i) => [entryKey(e), titles[i] || e.item.title]));
    const groups = groupByPhase(entries.filter(e => matchesQuery(e, query) || (titleOf.get(entryKey(e)) ?? '').toLowerCase().includes(query.trim().toLowerCase())), now);
    const pathOf = (e: GovernanceEntry) => `/${language}${governanceItemPath(e.systemKey, e.kind, e.id)}`;
    const byKey = new Map(entries.map(e => [entryKey(e), e]));

    const toggle = (phase: VotingPhase) => setExpanded(prev => {
        const next = new Set(autoCollapse ? [] : prev);
        if (prev.has(phase)) next.delete(phase); else next.add(phase);
        return next;
    });

    const groupTitle = { open: g.status_open, upcoming: g.status_upcoming, closed: g.status_closed, unknown: '' };
    const kindShort = { proposal: g.vote?.short_proposal || 'Proposal', temperature_check: g.vote?.short_temperature_check || 'Temperature check' };

    return (
        <SidebarLayout
            header={
                <SidebarGraphic
                    appName={g.sidebar_app || 'Radix · Governance'}
                    title={g.hero_title || 'Radix Governance'}
                    subtitle={g.hero_badge || 'On-ledger governance'}
                    idPrefix="governance"
                    variant="docs"
                />
            }
            searchBar={<SearchBar variant="sidebar" value={query} onChange={setQuery} placeholder={g.search_placeholder || 'Search by title'} />}
            controls={
                <SidebarControls
                    hasAnyExpanded={expanded.size > 0}
                    autoCollapse={autoCollapse}
                    onExpandAll={() => setExpanded(new Set(PHASE_ORDER))}
                    onCollapseAll={() => setExpanded(new Set())}
                    onAutoCollapseChange={setAutoCollapse}
                    collapseAllLabel={g.collapse_all}
                    expandAllLabel={g.expand_all}
                    autoCollapseActiveTitle={g.auto_collapse_on}
                    autoCollapseInactiveTitle={g.auto_collapse_off}
                />
            }
            onHeaderClick={() => router.push(`/${language}/governance`)}
            headerAriaLabel={g.back || 'All votes'}
        >
            <div className="space-y-3">
                {PHASE_ORDER.map(phase => {
                    const list = groups[phase];
                    if (list.length === 0) return null;
                    const items: SidebarCardItem[] = list.map(e => ({
                        id: entryKey(e),
                        label: titleOf.get(entryKey(e)) || g.vote?.untitled || 'untitled',
                        sublabel: `${kindShort[e.kind]} #${e.id} · ${e.systemName}`,
                        leftVisual: <ItemIcon kind={e.kind} selected={activePath === pathOf(e)} />,
                        href: pathOf(e),
                        prefetchOnHover: true,
                        isSelected: activePath === pathOf(e),
                    }));
                    return (
                        <SidebarCard
                            key={phase}
                            id={`governance-${phase}`}
                            icon={GROUP_STYLE[phase].icon}
                            gradient={GROUP_STYLE[phase].gradient}
                            title={groupTitle[phase] || phase}
                            searchQuery={query}
                            isExpanded={expanded.has(phase) || !!query.trim()}
                            hasSelectedItem={items.some(i => i.isSelected)}
                            headerBadge={
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                                    {list.length}
                                </span>
                            }
                            onToggle={() => toggle(phase)}
                            items={items}
                            richItems
                            onSelectItem={id => {
                                const e = byKey.get(id);
                                if (e) setPending({ path: pathOf(e), from: pathname });
                            }}
                        />
                    );
                })}
                {PHASE_ORDER.every(p => groups[p].length === 0) && (
                    <p className="text-xs text-center py-6 text-[var(--color-text-muted)]">{g.empty || 'No votes match these filters.'}</p>
                )}
            </div>
        </SidebarLayout>
    );
}
