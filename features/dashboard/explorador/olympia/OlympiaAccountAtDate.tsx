'use client';
/**
 * An Olympia account on a past day: what it held at the end of a UTC day of
 * Olympia (liquid XRD, tokens and stakes), as the official Olympia Gateway
 * answers for that ledger state. Read from the archive like the rest.
 *
 * The day is picked with the explorer's own calendar (DayPicker), limited to
 * the days Olympia ran.
 */
import React, { useState } from 'react';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';
import { DayPicker, dayLabel } from '../components/DayPicker';
import { OLYMPIA_END_ISO, OLYMPIA_START_ISO } from '@/features/dashboard/lib/olympia';
import { useOlympiaAccountAt } from '@/features/dashboard/services/olympiaApi';
import type { TranslationsT } from '@/features/dashboard/types';
import { fill, type OlympiaDict } from './dict';
import { formatAmount } from './format';
import { OlympiaStakesList, OlympiaTokensList } from './OlympiaAccountSections';
import { Empty, ErrorText, Loading, Section, Stat } from './OlympiaParts';

const FIRST_DAY = OLYMPIA_START_ISO.slice(0, 10);
const LAST_DAY = OLYMPIA_END_ISO.slice(0, 10);

export function OlympiaAccountAtDate({ address, o, locale, calendarT, t, onCopy, copiedAddress }: {
  address: string; o: OlympiaDict; locale: string; calendarT?: CalendarTranslations;
  t?: Partial<TranslationsT>; onCopy: (v: string) => void; copiedAddress: string | null;
}) {
  const [day, setDay] = useState('');
  const valid = day >= FIRST_DAY && day <= LAST_DAY;
  const { data: a, isLoading, isError } = useOlympiaAccountAt(address, valid ? day : null);
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <DayPicker day={day} onPick={setDay} calendarT={calendarT} placeholder={o.at_date_pick} locale={locale} minDate={FIRST_DAY} maxDate={LAST_DAY} />
        <p className="text-[11px] text-[var(--color-text-muted)]">{fill(o.at_date_desc, { from: dayLabel(FIRST_DAY, locale), to: dayLabel(LAST_DAY, locale) })}</p>
      </div>
      {!valid ? (
        <Empty text={o.at_date_empty} />
      ) : isLoading ? (
        <Loading text={o.loading} />
      ) : isError || !a ? (
        <ErrorText text={o.error} />
      ) : (
        <div className="space-y-5">
          <Section title={fill(o.at_date_state, { date: dayLabel(day, locale) })} aside={<span className="text-[10px] font-mono text-[var(--color-text-muted)]">{o.state_version} {a.stateVersion.toLocaleString(locale)}</span>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label={o.total_xrd} value={formatAmount(a.totals.totalXrd, locale)} tone="accent" />
              <Stat label={o.liquid_xrd} value={formatAmount(a.totals.liquidXrd, locale)} />
              <Stat label={o.staked_xrd} value={formatAmount(a.totals.stakedXrd, locale)} tone="primary" />
              <Stat label={o.unstaking_xrd} value={formatAmount(a.totals.unstakingXrd + a.totals.pendingStakeXrd, locale)} tone="secondary" />
            </div>
          </Section>
          <OlympiaTokensList a={a} o={o} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} emptyText={o.at_date_no_tokens} />
          <OlympiaStakesList a={a} o={o} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} emptyText={o.at_date_no_stakes} />
        </div>
      )}
    </div>
  );
}
