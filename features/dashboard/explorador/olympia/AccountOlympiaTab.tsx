'use client';
/**
 * The "Olympia" tab of a Babylon account that existed on Olympia (same key):
 * the full Olympia summary, its Olympia transactions, funds flow and staking
 * rewards with the yearly CSV.
 */
import React, { useState } from 'react';
import type { TranslationsT } from '@/features/dashboard/types';
import { useOlympiaAccount } from '@/features/dashboard/services/olympiaApi';
import { olympiaDict } from './dict';
import { OlympiaAccountOverview } from './OlympiaAccountSections';
import { OlympiaFundsPanel } from './OlympiaAccountCard';
import { OlympiaRewardsPanel } from './OlympiaRewardsPanel';
import { OlympiaTxTable } from './OlympiaTxTable';
import { Empty, ErrorText, FilterPills, Loading, OlympiaBadge, OlympiaRef, SourceNote } from './OlympiaParts';

type Part = 'summary' | 'transactions' | 'funds' | 'rewards';

export function AccountOlympiaTab({ babylonAddress, tt, locale, copiedAddress, onCopy }: {
  babylonAddress: string;
  tt?: Partial<TranslationsT['dashboard']['transactions']>;
  locale: string;
  copiedAddress: string | null;
  onCopy: (v: string) => void;
}) {
  const o = olympiaDict(tt);
  const [part, setPart] = useState<Part>('summary');
  const { data: a, isLoading, isError } = useOlympiaAccount(babylonAddress);
  if (isLoading) return <Loading text={o.loading} />;
  if (isError) return <ErrorText text={o.error} />;
  if (!a) return <Empty text={o.security_none} />;

  const parts: { key: Part; label: string }[] = [
    { key: 'summary', label: o.summary_tab },
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
      {part === 'summary' && <OlympiaAccountOverview a={a} o={o} locale={locale} />}
      {part === 'transactions' && <OlympiaTxTable address={a.address} o={o} locale={locale} />}
      {part === 'funds' && <OlympiaFundsPanel address={a.address} o={o} tt={tt} locale={locale} copiedAddress={copiedAddress} onCopy={onCopy} />}
      {part === 'rewards' && <OlympiaRewardsPanel a={a} o={o} locale={locale} />}
      <SourceNote o={o} />
    </div>
  );
}
