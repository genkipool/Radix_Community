'use client';
/**
 * The "Olympia" tab of a Babylon account that existed on Olympia (same key):
 * the full Olympia summary, its Olympia transactions, funds flow and staking
 * rewards with the yearly CSV.
 */
import React, { useState } from 'react';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';
import type { TranslationsT } from '@/features/dashboard/types';
import { useOlympiaAccount } from '@/features/dashboard/services/olympiaApi';
import { olympiaDict } from './dict';
import { OlympiaAccountAtDate } from './OlympiaAccountAtDate';
import { OlympiaAccountOverview } from './OlympiaAccountSections';
import { OlympiaFundsPanel } from './OlympiaAccountCard';
import { OlympiaRewardsPanel } from './OlympiaRewardsPanel';
import { OlympiaTxTable } from './OlympiaTxTable';
import { Empty, ErrorText, FilterPills, Loading, OlympiaBadge, OlympiaRef, SourceNote } from './OlympiaParts';

type Part = 'summary' | 'at_date' | 'transactions' | 'funds' | 'rewards';

export function AccountOlympiaTab({ babylonAddress, t, locale, copiedAddress, onCopy, calendarT }: {
  babylonAddress: string;
  /** The explorer translations: the Olympia entities opened in place need them all. */
  t?: Partial<TranslationsT>;
  /** The explorer calendar's strings, for the "on a date" view. */
  calendarT?: CalendarTranslations;
  locale: string;
  copiedAddress: string | null;
  onCopy: (v: string) => void;
}) {
  const tt = t?.dashboard?.transactions;
  const o = olympiaDict(tt);
  const [part, setPart] = useState<Part>('summary');
  const { data: a, isLoading, isError } = useOlympiaAccount(babylonAddress);
  if (isLoading) return <Loading text={o.loading} />;
  if (isError) return <ErrorText text={o.error} />;
  if (!a) return <Empty text={o.security_none} />;

  const parts: { key: Part; label: string }[] = [
    { key: 'summary', label: o.summary_tab },
    { key: 'at_date', label: o.at_date_tab },
    { key: 'transactions', label: o.transactions_tab },
    { key: 'funds', label: o.funds_tab },
    { key: 'rewards', label: o.rewards_tab },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <OlympiaBadge o={o} />
          <OlympiaRef value={a.address} locale={locale} full />
        </div>
        <FilterPills options={parts} value={part} onChange={setPart} />
      </div>
      {part === 'summary' && <OlympiaAccountOverview a={a} o={o} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} />}
      {part === 'at_date' && <OlympiaAccountAtDate address={a.address} o={o} locale={locale} calendarT={calendarT} t={t} onCopy={onCopy} copiedAddress={copiedAddress} />}
      {part === 'transactions' && <OlympiaTxTable address={a.address} o={o} locale={locale} />}
      {part === 'funds' && <OlympiaFundsPanel address={a.address} o={o} tt={tt} locale={locale} copiedAddress={copiedAddress} onCopy={onCopy} />}
      {part === 'rewards' && <OlympiaRewardsPanel a={a} o={o} locale={locale} />}
      <SourceNote o={o} />
    </div>
  );
}
