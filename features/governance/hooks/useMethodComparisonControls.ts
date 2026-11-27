'use client';

import { useState } from 'react';
import type { MethodFamily } from '../lib/methodCatalog';
import type { SortState } from '../lib/comparisonUtils';

/**
 * Shared filter, sort, and scroll-to-method state used by both
 * `MethodsComparison` and `HistoricalComparison`.
 */
export function useMethodComparisonControls(rowIdPrefix: string) {
    const [family, setFamily] = useState<MethodFamily | 'all'>('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortState>(null);
    const [focusedMethod, setFocusedMethod] = useState<{ key: string; nonce: number } | null>(null);

    const jumpToMethod = (methodKey: string | undefined) => {
        if (!methodKey) return;
        setFamily('all');
        setQuery('');
        setFocusedMethod(prev => ({ key: methodKey, nonce: (prev?.nonce ?? 0) + 1 }));
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.getElementById(`${rowIdPrefix}${methodKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
    };

    return {
        family,
        setFamily,
        query,
        setQuery,
        sort,
        setSort,
        focusedMethod,
        jumpToMethod,
    };
}
