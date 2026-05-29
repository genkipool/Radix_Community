'use client';

import React, { createContext, use, ReactNode } from 'react';
import { ForumCtxValue } from '../types/context.types';
import { useForumState } from '../hooks/useForumState';
import { ForumClientProps } from '../types/components.types';

const ForumCtx = createContext<ForumCtxValue | null>(null);

export function ForumProvider({ children, props }: { children: ReactNode; props: ForumClientProps }) {
    const state = useForumState(props);
    const value: ForumCtxValue = {
        t: props.t,
        language: props.language,
        users: props.initialUsers,
        ...state
    };

    return <ForumCtx.Provider value={value}>{children}</ForumCtx.Provider>;
}

export function useForum() {
    const context = use(ForumCtx);
    if (!context) {
        throw new Error('useForum must be used within a ForumProvider');
    }
    return context;
}
