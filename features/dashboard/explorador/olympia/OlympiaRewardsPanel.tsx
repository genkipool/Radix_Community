'use client';
import React from 'react';
import type { OlympiaAccountSummary } from '@/types/olympia';
import { endOfOlympia, type OlympiaDict } from './dict';
import { formatAmount } from './format';
import { OlympiaRewardsCsv } from './OlympiaRewardsCsv';
import { Empty, Section, Stat } from './OlympiaParts';

/** An account's Olympia staking rewards: totals and the yearly CSV download. */
export function OlympiaRewardsPanel({ a, o, locale }: { a: OlympiaAccountSummary; o: OlympiaDict; locale: string }) {
  if (a.rewards.years.length === 0) return <Empty text={o.rewards_csv_empty} />;
  return (
    <div className="space-y-4">
      <Section title={o.rewards_title}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label={o.rewards_total_delegator} value={`${formatAmount(a.rewards.delegatorXrd, locale)} XRD`} tone="accent" hint={endOfOlympia(o, locale).until} />
          {a.rewards.validatorFeeXrd > 0 && <Stat label={o.rewards_total_fee} value={`${formatAmount(a.rewards.validatorFeeXrd, locale)} XRD`} tone="primary" hint={endOfOlympia(o, locale).until} />}
          <Stat label={o.rewards_year} value={a.rewards.years.join(' · ')} />
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)]">{o.rewards_desc}</p>
      </Section>
      <OlympiaRewardsCsv subject="account" address={a.address} years={a.rewards.years} o={o} locale={locale} kinds={a.rewards.validatorFeeXrd > 0} />
    </div>
  );
}
