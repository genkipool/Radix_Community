
'use client';
import { createContext, use } from 'react';


import type { ElementType } from 'react';
export const EntityBadgeContext = createContext<ElementType | null>(null);

export function useEntityBadge() {
    const context = use(EntityBadgeContext);
    if (!context) {
        throw new Error('useEntityBadge must be used within an EntityBadgeProvider');
    }
    return context;
}
