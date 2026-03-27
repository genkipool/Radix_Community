'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCookie, setCookie } from '@/utils/cookies';

/* ─── Options ────────────────────────────────────────────────────────────── */

interface UsePersistentExpandSetOptions {
  /** Cookie key for the serialised set of expanded IDs */
  cookieKeyItems: string;
  /** Cookie key for the auto-collapse preference */
  cookieKeyAutoCollapse: string;
  /** Full list of IDs (used by expandAll and expandOnSearch) */
  allIds: string[];
  /**
   * Whether all items should be expanded by default when no cookie is saved.
   */
  defaultExpandAll?: boolean;
  /** Initial auto-collapse state from SSR */
  initialAutoCollapse: boolean;
  /** Initial expanded topics string from SSR */
  initialExpandedTopics: string;
}

/* ─── Return ─────────────────────────────────────────────────────────────── */

interface UsePersistentExpandSetReturn {
  expandedIds: Set<string>;
  autoCollapse: boolean;
  handleToggle: (id: string) => void;
  handleExpandAll: () => void;
  handleCollapseAll: () => void;
  handleAutoCollapseChange: (value: boolean) => void;
  expandAllOnSearch: () => void;
}

/* ─── Hook ───────────────────────────────────────────────────────────────── */

/**
 * Manages persisted documentation preferences using React Query and Server Actions.
 * initialData from SSR prevents hydration mismatch.
 */
export function usePersistentExpandSet({
  cookieKeyItems,
  cookieKeyAutoCollapse,
  allIds,
  defaultExpandAll = false,
  initialAutoCollapse,
  initialExpandedTopics,
}: UsePersistentExpandSetOptions): UsePersistentExpandSetReturn {
  const queryClient = useQueryClient();

  // 1. Query for Auto-collapse preference
  const autoCollapseQuery = useQuery({
    queryKey: [cookieKeyAutoCollapse],
    queryFn: () => {
      // On the client, we can still read the cookie to be latest
      if (typeof window !== 'undefined') {
        const c = getCookie(cookieKeyAutoCollapse);
        if (c !== null) return c === 'true';
      }
      return initialAutoCollapse;
    },
    initialData: initialAutoCollapse,
    staleTime: Infinity,
  });

  // 2. Query for Expanded IDs
  const expandedQuery = useQuery({
    queryKey: [cookieKeyItems],
    queryFn: () => {
      if (typeof window !== 'undefined') {
        const saved = getCookie(cookieKeyItems);
        if (saved !== null) return new Set(saved.split(',').filter(Boolean));
      }
      return initialExpandedTopics 
        ? new Set(initialExpandedTopics.split(',').filter(Boolean))
        : (defaultExpandAll ? new Set(allIds) : new Set<string>());
    },
    initialData: initialExpandedTopics 
      ? new Set(initialExpandedTopics.split(',').filter(Boolean))
      : (defaultExpandAll ? new Set(allIds) : new Set<string>()),
    staleTime: Infinity,
  });

  const autoCollapse = autoCollapseQuery.data;
  const expandedIds = expandedQuery.data;

  // 4. Handlers
  const handleToggle = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (autoCollapse) next.clear();
      next.add(id);
    }
    const val = Array.from(next).join(',');
    if (typeof window !== 'undefined') setCookie(cookieKeyItems, val);
    queryClient.setQueryData([cookieKeyItems], next);
  };

  const handleExpandAll = () => {
    const val = allIds.join(',');
    if (typeof window !== 'undefined') setCookie(cookieKeyItems, val);
    queryClient.setQueryData([cookieKeyItems], new Set(allIds));
  };

  const handleCollapseAll = () => {
    if (typeof window !== 'undefined') setCookie(cookieKeyItems, '');
    queryClient.setQueryData([cookieKeyItems], new Set<string>());
  };

  const handleAutoCollapseChange = (value: boolean) => {
    if (typeof window !== 'undefined') setCookie(cookieKeyAutoCollapse, String(value));
    queryClient.setQueryData([cookieKeyAutoCollapse], value);
  };

  const expandAllOnSearch = () => {
    if (expandedIds.size === allIds.length) return;
    const val = allIds.join(',');
    if (typeof window !== 'undefined') setCookie(cookieKeyItems, val);
    queryClient.setQueryData([cookieKeyItems], new Set(allIds));
  };

  return {
    expandedIds,
    autoCollapse,
    handleToggle,
    handleExpandAll,
    handleCollapseAll,
    handleAutoCollapseChange,
    expandAllOnSearch,
  };
}
