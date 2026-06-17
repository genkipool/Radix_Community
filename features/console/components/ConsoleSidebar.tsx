'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { SidebarGraphic } from '@/components/ui/SidebarGraphic';
import { SearchBar } from '@/components/ui/SearchBar';
import { SidebarControls } from '@/components/ui/SidebarControls';
import { SidebarCard, type SidebarCardItem } from '@/components/ui/SidebarCard';
import { usePersistentExpandSet } from '@/hooks/usePersistentExpandSet';
import { setCookie } from '@/utils/cookies';
import type { Dictionary } from '@/i18n';
import { CONSOLE_GROUPS } from '../data/consoleTools';
import { useConsoleDictionary } from '../hooks/useConsoleDictionary';
import { NetworkSwitch } from './NetworkSwitch';
import { Info } from 'lucide-react';
import { CONSOLE_TOOL_SLUGS, type ConsoleToolSlug } from '../types/console.types';
import { ToolInfoModal } from './shared/ToolInfoModal';

export const CONSOLE_COOKIE_OPEN_GROUPS = 'console_open_groups';
export const CONSOLE_COOKIE_AUTO_COLLAPSE = 'console_auto_collapse';
export const CONSOLE_COOKIE_FLAT_VIEW = 'console_flat_view';

interface ConsoleSidebarProps {
  dictionary?: Partial<Dictionary>;
  selectedSlug: ConsoleToolSlug | null;
  onSelectTool: (slug: ConsoleToolSlug) => void;
  onHomeClick: () => void;
  initialAutoCollapse: boolean;
  initialExpandedGroups: string;
  initialFlatView: boolean;
}

export default function ConsoleSidebar({
  dictionary,
  selectedSlug,
  onSelectTool,
  onHomeClick,
  initialAutoCollapse,
  initialExpandedGroups,
  initialFlatView,
}: ConsoleSidebarProps) {
  const t = useConsoleDictionary(dictionary);
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [flatView, setFlatView] = useState(initialFlatView);
  const [infoModalSlug, setInfoModalSlug] = useState<ConsoleToolSlug | null>(null);

  const {
    expandedIds: expandedGroups,
    autoCollapse,
    handleToggle,
    handleExpandAll,
    handleCollapseAll,
    handleAutoCollapseChange,
  } = usePersistentExpandSet({
    cookieKeyItems: CONSOLE_COOKIE_OPEN_GROUPS,
    cookieKeyAutoCollapse: CONSOLE_COOKIE_AUTO_COLLAPSE,
    allIds: CONSOLE_GROUPS.map((group) => group.id),
    defaultExpandAll: false,
    initialAutoCollapse,
    initialExpandedTopics: initialExpandedGroups,
  });

  const groupLabels = (t.groups ?? {}) as Record<string, string>;
  const toolLabels = (t.tools ?? {}) as Record<string, { title?: string; description?: string }>;
  const sidebarT = t.sidebar ?? ({} as NonNullable<typeof t.sidebar>);

  const toolHref = (slug: ConsoleToolSlug) => `/${language}/console/${slug}`;

  const toggleFlatView = () => {
    setFlatView((prev) => {
      setCookie(CONSOLE_COOKIE_FLAT_VIEW, String(!prev));
      return !prev;
    });
  };

  const matchesQuery = (slug: ConsoleToolSlug, query: string) => {
    const labels = toolLabels[slug] ?? {};
    return (
      (labels.title ?? slug).toLowerCase().includes(query) ||
      (labels.description ?? '').toLowerCase().includes(query)
    );
  };

  /* Filter groups/tools by search query (title + description) */
  const query = searchQuery.trim().toLowerCase();
  const filteredGroups = CONSOLE_GROUPS.flatMap((group) => {
    if (!query) return [group];
    const groupLabel = (groupLabels[group.id] ?? group.id).toLowerCase();
    if (groupLabel.includes(query)) return [group];
    const matching = group.tools.filter((slug) => matchesQuery(slug, query));
    return matching.length > 0 ? [{ ...group, tools: matching }] : [];
  });

  const flatTools = CONSOLE_TOOL_SLUGS.filter((slug) => !query || matchesQuery(slug, query));
  const noResults = flatView ? flatTools.length === 0 : filteredGroups.length === 0;

  return (
    <SidebarLayout
      header={
        <SidebarGraphic
          appName={sidebarT.appName ?? 'Radix Developer Console'}
          title={sidebarT.title ?? 'Radix Console'}
          subtitle={sidebarT.subtitle ?? ''}
          idPrefix="console"
          variant="developers"
        />
      }
      searchBar={
        <SearchBar
          variant="sidebar"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t.searchPlaceholder ?? ''}
          id="console-search"
        />
      }
      controls={
        <SidebarControls
          leading={<NetworkSwitch />}
          hasAnyExpanded={expandedGroups.size > 0}
          autoCollapse={autoCollapse}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onAutoCollapseChange={handleAutoCollapseChange}
          collapseAllLabel={sidebarT.collapse_all ?? 'Collapse all'}
          expandAllLabel={sidebarT.expand_all ?? 'Expand all'}
          gridView={flatView}
          onGridViewToggle={toggleFlatView}
          gridViewTitle={sidebarT.flat_view ?? 'List view'}
        />
      }
      onHeaderClick={onHomeClick}
      headerAriaLabel={sidebarT.home_aria}
      heightOffset={80}
      className="h-full"
    >
      {flatView ? (
        /* Flat view: every tool as a plain text row, single column */
        <div className="space-y-0.5">
          {flatTools.map((slug) => {
            const isSelected = slug === selectedSlug;
            return (
              <div key={slug} className="relative group flex items-center">
                <Link
                  href={toolHref(slug)}
                  onClick={(e) => {
                    if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault();
                      onSelectTool(slug);
                    }
                  }}
                  className="block flex-1 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={
                    isSelected
                      ? { background: 'var(--color-primary)', color: 'var(--color-bg)', fontWeight: 600 }
                      : { color: 'var(--color-text-muted)' }
                  }
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--color-surface)';
                      e.currentTarget.style.color = 'var(--color-text-main)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '';
                      e.currentTarget.style.color = 'var(--color-text-muted)';
                    }
                  }}
                >
                  {toolLabels[slug]?.title ?? slug}
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setInfoModalSlug(slug);
                  }}
                  title="Info"
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
                  style={{
                    background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--color-surface)',
                    color: isSelected ? 'var(--color-bg)' : 'var(--color-text-muted)',
                    border: `1px solid ${isSelected ? 'transparent' : 'var(--color-card-border)'}`,
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card-border)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
                    }
                  }}
                >
                  <Info className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id) || !!query;
            const hasSelected = selectedSlug !== null && group.tools.includes(selectedSlug);

            const items: SidebarCardItem[] = group.tools.map((slug) => ({
              id: slug,
              label: toolLabels[slug]?.title ?? slug,
              isSelected: slug === selectedSlug,
              href: toolHref(slug),
              actions: [
                {
                  icon: <Info className="size-3.5" />,
                  title: 'Info',
                  onClick: () => setInfoModalSlug(slug),
                }
              ]
            }));

            return (
              <SidebarCard
                key={group.id}
                id={group.id}
                icon={group.icon}
                gradient={group.gradient}
                title={groupLabels[group.id] ?? group.id}
                searchQuery={searchQuery}
                isExpanded={isExpanded}
                hasSelectedItem={hasSelected}
                headerBadge={
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                    style={{
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-muted)',
                      border: '1px solid var(--color-card-border)',
                    }}
                  >
                    {group.tools.length}
                  </span>
                }
                onToggle={() => handleToggle(group.id)}
                items={items}
                onSelectItem={(id) => onSelectTool(id as ConsoleToolSlug)}
              />
            );
          })}
        </div>
      )}

      {noResults && (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t.noResults} &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      <ToolInfoModal
        isOpen={!!infoModalSlug}
        onClose={() => setInfoModalSlug(null)}
        slug={infoModalSlug}
        t={dictionary as Dictionary}
      />
    </SidebarLayout>
  );
}
