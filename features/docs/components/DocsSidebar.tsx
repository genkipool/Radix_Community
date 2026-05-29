'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { SidebarGraphic } from '@/components/ui/SidebarGraphic';
import { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { DOCS_MAP } from '../data/docsData';
import type { Topic, DocItem } from '../types/data.types';
import type { DocsSidebarProps } from '../types/components.types';
import type { Dictionary } from '@/i18n';
import type { DocsDictionary } from '../types/i18n.types';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { SearchBar } from '@/components/ui/SearchBar';
import { SidebarControls } from '@/components/ui/SidebarControls';
import { SidebarCard, HighlightText, type SidebarCardItem } from '@/components/ui/SidebarCard';
import { TOPICS } from '../data/docsTopics';

export { HighlightText as Highlight } from '@/components/ui/SidebarCard';

/* ─── Content snippet helper ─── */
function getSnippet(text: string, query: string): string {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return '';
    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + query.length + 40);
    return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

/* ─── Props ─── */

const EMPTY_DOCS: import('../../types/data.types').UserDoc[] = [];

export default function DocsSidebar({
    searchQuery,
    onSearchQueryChange,
    onAdminClick,
    isEditorOpen = false,
    userDocs = EMPTY_DOCS,
    onEditUserDoc,
    onDeleteUserDoc,
    searchValue = '',
    className = '',
    dictionary,
}: DocsSidebarProps & { dictionary?: Partial<Dictionary> }) {
    const { t: dict } = useLanguage();
    const t = (dictionary?.docs || dict?.docs || {}) as DocsDictionary;
    const docLabels = t.documents || {};
    const topicLabels = t.topics || {};
    const content = t.content || {};
    const sidebarT = t.sidebar || {};
    const svgText = t.svg || {};

    const collapseAllLabel = sidebarT?.collapse_all ?? 'Collapse all';
    const expandAllLabel = sidebarT?.expand_all ?? 'Expand all';

    const { language } = useLanguage();

    /* Build search index: docId → { title, bodyTexts } (Cached at module level via useEffect) */
    const searchIndex = (() => {
        const cached = _searchIndexCache[language];
        if (cached) return cached as Record<string, { title: string; bodyTexts: { key: string; text: string }[] }>;

        const idx: Record<string, { title: string; bodyTexts: { key: string; text: string }[] }> = {};
        for (const [docId, docData] of Object.entries(DOCS_MAP)) {
            idx[docId] = {
                title: docLabels?.[docData.titleKey] ?? docData.titleKey,
                bodyTexts: docData.toc.map(entry => ({
                    key: entry.bodyKey,
                    text: content?.[entry.bodyKey] ?? '',
                })),
            };
        }
        return idx;
    })();

    // Cache at module level during render
    if (!_searchIndexCache[language] && searchIndex) {
        _searchIndexCache[language] = searchIndex;
    }

    /* 1. Build topics including user docs — React Compiler handles memoization */
    const topicsWithUserDocs = (() => {
        return TOPICS.map(topic => {
            const communityDocs = userDocs
                .flatMap(d => d.topic === topic.id ? [{ id: d.id, titleKey: d.id, _userTitle: d.title }] : []);
            return communityDocs.length > 0
                ? { ...topic, docs: [...topic.docs, ...communityDocs] }
                : topic;
        });
    })();

    /* 2. Filter topics based on search — React Compiler handles memoization */
    const filteredTopics = (() => {
        let res: Topic[];
        if (!searchQuery.trim()) {
            res = topicsWithUserDocs;
        } else {
            const q = searchQuery.toLowerCase();
            res = topicsWithUserDocs.flatMap(topic => {
                const topicLabel = topicLabels?.[topic.topicKey] ?? topic.topicKey;
                const topicMatches = topicLabel.toLowerCase().includes(q);
                const matchingDocs = topic.docs.filter(doc => {
                    const userTitle = doc._userTitle;
                    if (userTitle) return userTitle.toLowerCase().includes(q);
                    const indexed = searchIndex[doc.id];
                    if (!indexed) return (docLabels?.[doc.titleKey] ?? '').toLowerCase().includes(q);
                    if (indexed.title.toLowerCase().includes(q)) return true;
                    return indexed.bodyTexts.some((b: { text: string }) => b.text.toLowerCase().includes(q));
                });
                if (topicMatches) return [{ ...topic }];
                if (matchingDocs.length > 0) return [{ ...topic, docs: matchingDocs }];
                return [];
            }) as Topic[];
        }

        return res;
    })();

    const hasAnyExpanded = expandedTopics.size > 0;

    const header = (
        <SidebarGraphic
            appName={svgText?.appName ?? 'Radix Babylon Ledger App'}
            title={svgText?.docsTitle ?? 'Radix Documentos'}
            subtitle={svgText?.docsSubtitle ?? 'Explora la documentación oficial.'}
            badgeLabel={svgText?.ledger ?? 'LEDGER'}
            idPrefix="docs"
            variant="docs"
        />
    );

    const searchBar = (
        <SearchBar variant="sidebar"
            value={searchValue}
            onChange={onSearchQueryChange}
            placeholder={t.searchPlaceholder ?? ''}
        />
    );

    const controls = (
        <SidebarControls
            hasAnyExpanded={hasAnyExpanded}
            autoCollapse={autoCollapse}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
            onAutoCollapseChange={onAutoCollapseChange}
            collapseAllLabel={collapseAllLabel}
            expandAllLabel={expandAllLabel}
        />
    );

    return (
        <SidebarLayout
            header={header}
            searchBar={searchBar}
            controls={controls}
            onHeaderClick={() => onSelectDoc(null)}
            headerAriaLabel={sidebarT?.docs_home_aria ?? 'Ir al inicio de documentos'}
            heightOffset={80}
            className={className}
        >
            <div className="space-y-3">
                {filteredTopics.map((topic: Topic) => {
                    const isExpanded = expandedTopics.has(topic.id);
                    const isAdmin = topic.id === 'admin';
                    const isAdminActive = isAdmin && isEditorOpen;
                    const topicLabel = topicLabels?.[topic.topicKey] ?? topic.topicKey;

                    /* Build items for SidebarCard */
                    const items: SidebarCardItem[] = topic.docs.map((doc: DocItem) => {
                        const isUserDoc = !!doc._userTitle;
                        const label = doc._userTitle ?? docLabels?.[doc.titleKey] ?? doc.titleKey;
                        const indexed = searchIndex[doc.id];
                        const q = searchQuery.toLowerCase().trim();

                        /* Content snippet for search results */
                        let sublabel: ReactNode | undefined;
                        if (q && indexed) {
                            const titleMatch = label.toLowerCase().includes(q);
                            if (!titleMatch) {
                                const bodyMatch = indexed.bodyTexts.find((b: { text: string }) => b.text.toLowerCase().includes(q));
                                if (bodyMatch) {
                                    const snippet = getSnippet(bodyMatch.text, searchQuery);
                                    sublabel = (
                                        <p className="text-xs mt-1 leading-relaxed" style={{ opacity: 0.8 }}>
                                            <HighlightText text={snippet} query={searchQuery} />
                                        </p>
                                    );
                                }
                            }
                        }

                        return {
                            id: doc.id,
                            label,
                            sublabel,
                            isSelected: doc.id === selectedDocId,
                            actions: isUserDoc ? [
                                ...(onEditUserDoc ? [{
                                    icon: <Pencil className="size-3.5" />,
                                    onClick: () => onEditUserDoc(doc.id),
                                    title: t.edit ?? 'Edit'
                                }] : []),
                                ...(onDeleteUserDoc ? [{
                                    icon: <Trash2 className="size-3.5" />,
                                    onClick: () => onDeleteUserDoc(doc.id),
                                    title: t.delete ?? 'Delete',
                                    color: 'var(--color-primary)'
                                }] : [])
                            ] : undefined,
                        };
                    });

                    /* Admin badge: stable container to avoid layout shift */
                    const adminBadge = isAdmin ? (
                        <div className="size-6 flex items-center justify-center shrink-0">
                            {isAdminActive
                                ? <span className="size-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
                                : <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                    style={{
                                        background: 'rgba(var(--color-primary-rgb), 0.15)',
                                        color: 'var(--color-primary)',
                                        border: '1px solid rgba(var(--color-primary-rgb), 0.3)',
                                    }}
                                >+</span>
                            }
                        </div>
                    ) : undefined;

                    /* Topic has selected doc badge */
                    const hasSelectedDoc = topic.docs.some((d) => d.id === selectedDocId);
                    const countBadge = !isAdmin ? (
                        <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}
                        >
                            {topic.docs.length}
                        </span>
                    ) : undefined;

                    return (
                        <SidebarCard
                            key={topic.id}
                            id={topic.id}
                            icon={topic.icon}
                            gradient={topic.gradient}
                            title={topicLabel}
                            searchQuery={searchQuery}
                            isExpanded={isExpanded}
                            hasSelectedItem={hasSelectedDoc}
                            isSpecialActive={isAdminActive}
                            headerBadge={adminBadge ?? countBadge}
                            onToggle={() => {
                                if (isAdmin && onAdminClick) {
                                    onAdminClick();
                                } else {
                                    onTopicToggle(topic.id);
                                }
                            }}
                            items={items}
                            onSelectItem={id => onSelectDoc(id)}
                        />
                    );
                })}

                {filteredTopics.length === 0 && (
                    <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {(t as unknown as { noResults?: string }).noResults ?? 'Sin resultados'} &ldquo;{searchQuery}&rdquo;
                    </p>
                )}
            </div>
        </SidebarLayout>
    );
}
