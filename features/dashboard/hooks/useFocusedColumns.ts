'use client';

import { useState } from 'react';
import { resolveEntityKind } from '@/features/dashboard/lib/routes';

/**
 * Drops the card grid to one column while a single validator is in focus.
 *
 * A grid two or more columns wide holding exactly one card leaves it stranded
 * beside empty space, so focusing a validator (by opening its URL or by pasting
 * its address into the search box) collapses the grid.
 *
 * The stored preference is deliberately NOT touched. `valColumns` is written
 * straight to a cookie, so forcing it would overwrite the user's own setting
 * and leave nothing to restore. This is an override that sits on top:
 *
 *   focus starts   the grid goes to one column
 *   focus ends     the stored preference comes back, untouched
 *   slider moved   the override is dropped, because an explicit choice
 *                  outranks the automatic one
 */
export interface UseFocusedColumnsResult {
  /** Column count the grid should actually use. */
  columns: number;
  /** True while the override is what is driving `columns`. */
  isOverridden: boolean;
  /** Call when the user sets a column count by hand. */
  releaseOverride: () => void;
}

export function useFocusedColumns(
  searchQuery: string,
  storedColumns: number,
): UseFocusedColumnsResult {
  const focused = resolveEntityKind(searchQuery.trim()) === 'validator';

  const [override, setOverride] = useState<number | null>(focused ? 1 : null);
  // Adjusting state during render rather than in an effect: the grid must not
  // paint one frame at the old column count and then snap.
  const [wasFocused, setWasFocused] = useState(focused);
  if (focused !== wasFocused) {
    setWasFocused(focused);
    setOverride(focused ? 1 : null);
  }

  return {
    columns: override ?? storedColumns,
    isOverridden: override !== null,
    releaseOverride: () => setOverride(null),
  };
}
