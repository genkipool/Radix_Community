'use client';
/**
 * The "Olympia" tab of a Babylon token that was migrated from an Olympia token,
 * as Babylon accounts have one for the Olympia account they came from: the
 * Olympia token's summary and its holders when Olympia ended.
 */
import React, { useState } from 'react';
import type { TranslationsT } from '@/features/dashboard/types';
import type { OlympiaResource } from '@/types/olympia';
import { olympiaDict } from './dict';
import { FilterPills, OlympiaBadge, OlympiaRef, SourceNote } from './OlympiaParts';
import { OlympiaResourceHolders, OlympiaResourceSummary } from './OlympiaResourcePanel';

type Part = 'summary' | 'holders';

export function ResourceOlympiaTab({ r, tt, locale, onCopy, copiedAddress }: {
  r: OlympiaResource;
  tt?: Partial<TranslationsT['dashboard']['transactions']>;
  locale: string;
  onCopy: (v: string) => void;
  copiedAddress: string | null;
}) {
  const o = olympiaDict(tt);
  const [part, setPart] = useState<Part>('summary');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <OlympiaBadge o={o} />
          <OlympiaRef value={r.rri} locale={locale} full />
        </div>
        <FilterPills options={[{ key: 'summary', label: o.summary_tab }, { key: 'holders', label: o.holders_tab }]} value={part} onChange={setPart} />
      </div>
      {part === 'summary' && <OlympiaResourceSummary r={r} tt={tt} o={o} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} />}
      {part === 'holders' && <OlympiaResourceHolders r={r} locale={locale} />}
      <SourceNote o={o} />
    </div>
  );
}
