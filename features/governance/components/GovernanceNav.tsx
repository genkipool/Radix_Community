'use client';

import React, { createContext, use, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface GovernanceNav {
    /** The overview is the current page (otherwise it is folded away). */
    onOverview: boolean;
    /** The overview has been shown in this visit, so it stays mounted to fold and unfold. */
    overviewMounted: boolean;
    /**
     * Opens a vote. From the overview it jumps to the top and navigates without
     * the router's own scrolling, so the overview folds away above the vote
     * exactly like the Docs hero; returns true when it took over the click.
     */
    openVote: (href: string, e?: React.MouseEvent) => boolean;
}

const Ctx = createContext<GovernanceNav>({ onOverview: false, overviewMounted: false, openVote: () => false });

export function GovernanceNavProvider({ language, children }: { language: string; children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const onOverview = pathname === `/${language}/governance`;
    const [overviewMounted, setOverviewMounted] = useState(onOverview);
    // Adjusted while rendering so the overview is there on its first paint.
    if (onOverview && !overviewMounted) setOverviewMounted(true);

    const openVote = (href: string, e?: React.MouseEvent) => {
        if (!onOverview) return false;
        // New tab, new window and the like keep the browser's behaviour.
        if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return false;
        e?.preventDefault();
        window.scrollTo({ top: 0, behavior: 'instant' });
        router.push(href, { scroll: false });
        return true;
    };

    return <Ctx value={{ onOverview, overviewMounted, openVote }}>{children}</Ctx>;
}

export const useGovernanceNav = () => use(Ctx);
