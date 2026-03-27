'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { ForumCtxValue } from '../types';
import { useForumState } from '../hooks/useForumState';
import { ForumClientProps } from '../types';

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
    const context = useContext(ForumCtx);
    if (!context) {
        throw new Error('useForum must be used within a ForumProvider');
    }
    return context;
}
