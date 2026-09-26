'use client';

import React, { createContext, use, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** How long the overview takes to fold away, same as the Docs hero. */
export const LEAVE_MS = 400;

interface GovernanceNav {
    /** The overview is folding away before a vote opens. */
    leaving: boolean;
    /** The page was just opened from the overview: it slides in. */
    entering: boolean;
    /**
     * Opens a vote. From the overview it first folds the overview away, as the
     * Docs page does when a document is picked, and returns true (the caller
     * then cancels its own navigation); anywhere else it returns false.
     */
    openVote: (href: string, e?: React.MouseEvent) => boolean;
}

const Ctx = createContext<GovernanceNav>({ leaving: false, entering: false, openVote: () => false });

export function GovernanceNavProvider({ language, children }: { language: string; children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [leavingFrom, setLeavingFrom] = useState<string | null>(null);
    const [entering, setEntering] = useState(false);
    // Adjusted while rendering (not in an effect) so the new page's first
    // paint already knows whether it arrived from the overview.
    const [seenPath, setSeenPath] = useState(pathname);
    if (pathname !== seenPath) {
        setSeenPath(pathname);
        setEntering(leavingFrom === seenPath);
        setLeavingFrom(null);
    }

    const openVote = (href: string, e?: React.MouseEvent) => {
        if (pathname !== `/${language}/governance`) return false;
        // New tab, new window and the like keep the browser's behaviour.
        if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return false;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        e?.preventDefault();
        if (leavingFrom) return true;
        setLeavingFrom(pathname);
        router.prefetch(href);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.setTimeout(() => router.push(href, { scroll: false }), LEAVE_MS);
        return true;
    };

    return <Ctx value={{ leaving: leavingFrom === pathname, entering, openVote }}>{children}</Ctx>;
}

export const useGovernanceNav = () => use(Ctx);

/** The routed page; slides in when it was opened from the overview. */
export function GovernancePage({ children }: { children: React.ReactNode }) {
    const { entering } = useGovernanceNav();
    const pathname = usePathname();
    return (
        <div key={entering ? pathname : 'page'} className={`flex-1 flex flex-col min-w-0 ${entering ? 'animate-hero-in' : ''}`}>
            {children}
        </div>
    );
}
