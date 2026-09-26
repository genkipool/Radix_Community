'use client';

import React from 'react';
import type { GovernanceEntry } from '../types';
import { GovernanceSidebar } from './GovernanceSidebar';
import type { G } from './GovernanceBadges';

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
        <div className="flex flex-col md:flex-row w-full flex-1 min-h-screen pt-20 bg-[var(--color-bg)]">
            <GovernanceSidebar entries={entries} g={g} language={language} serverNow={serverNow} />
            <main className="flex-1 relative min-w-0 flex flex-col" style={{ overflowX: 'clip' }}>
                {children}
            </main>
        </div>
    );
}
