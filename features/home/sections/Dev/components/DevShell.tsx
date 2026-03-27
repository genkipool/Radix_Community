'use client';
/**
 * DesarrolladoresShell — Client Component (boundary)
 *
 * Owns only the tab index state and the tab navigation buttons.
 * The four panel children (DevTab0–3 + DevConsole) are RSC subtrees passed in
 * as props from Desarrolladores (RSC), so they are never bundled on the client.
 */
import { useSpeedSyncURL } from '@/hooks/useSpeedSyncURL';

import type { DevShellProps } from '../../../types';

const SLUGS = [
  'scrypto-vs-solidity',
  'blueprints-components',
  'transaction-manifests',
  'dev-toolkit'
];

export function DevShell({ t: _t, tabs, tab0, tab1, tab2, tab3 }: DevShellProps) {
  const [view, setView] = useSpeedSyncURL<string>('view', SLUGS[0]);

  const activeTab = SLUGS.indexOf(view || SLUGS[0]);

  const handleTabChange = (index: number) => {
    setView(SLUGS[index]);
  };

  const panels = [tab0, tab1, tab2, tab3] as const;

  return (
    <>
      {/* Tab navigation */}
      <div className="flex flex-wrap justify-center gap-4 mb-12">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => handleTabChange(i)}
            className={`px-6 py-3 rounded-full font-bold text-sm ${activeTab === i
              ? 'bg-[var(--color-primary)] text-white shadow-md'
              : 'bg-[var(--color-bg)] border border-[var(--color-card-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Active tab panel */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-3xl p-8 shadow-xl relative overflow-hidden min-h-[500px]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        {panels[activeTab]}
      </div>
    </>
  );
}
