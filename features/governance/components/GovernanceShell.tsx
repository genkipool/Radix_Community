'use client';

import React from 'react';
import type { GovernanceEntry } from '../types';
import { GovernanceSidebar } from './GovernanceSidebar';
import { BrowserTranslationProvider } from './BrowserTranslation';
import { GovernanceNavProvider, useGovernanceNav } from './GovernanceNav';
import { GovernanceOverview } from './GovernanceOverview';
import type { G } from './GovernanceBadges';

/**
 * The overview lives in the frame rather than in its own page, above every
 * vote: opening a vote folds it away while the vote is already on screen
 * below, the same movement as the Docs hero. Rendered only once the overview
 * has been visited, so a vote opened directly does not load it.
 */
function OverviewSlot(props: { entries: GovernanceEntry[]; g: G; language: string; serverNow: number }) {
    const { onOverview, overviewMounted } = useGovernanceNav();
    if (!overviewMounted) return null;
    return <GovernanceOverview {...props} collapsed={!onOverview} />;
}

/**
 * Section frame, same as Docs and Games: the list of votes on the left (hidden
 * on phones, where the overview grid takes its place) and the page on the right.
 */
export function GovernanceShell({ entries, g, language, serverNow, children }: {
    entries: GovernanceEntry[];
    g: G;
    language: string;
    serverNow: number;
    children: React.ReactNode;
}) {
    return (
        <BrowserTranslationProvider language={language}>
            <GovernanceNavProvider language={language}>
            <div className="flex flex-col md:flex-row w-full flex-1 min-h-screen pt-20 bg-[var(--color-bg)]">
                <GovernanceSidebar entries={entries} g={g} language={language} serverNow={serverNow} />
                <main className="flex-1 relative min-w-0 flex flex-col" style={{ overflowX: 'clip' }}>
                    <OverviewSlot entries={entries} g={g} language={language} serverNow={serverNow} />
                    {children}
                </main>
            </div>
            </GovernanceNavProvider>
        </BrowserTranslationProvider>
    );
}
