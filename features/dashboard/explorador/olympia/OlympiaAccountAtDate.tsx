'use client';
/**
 * An Olympia account on a past day: what it held at the end of a UTC day of
 * Olympia (liquid XRD, tokens and stakes), as the official Olympia Gateway
 * answers for that ledger state. Read from the archive like the rest.
 *
 * Drawn in the shared date-tab frame (AtDateView), limited to the days
 * Olympia ran.
 */
import React, { useState } from 'react';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';
import { AtDateView } from '../components/AtDateView';
import { OLYMPIA_END_ISO, OLYMPIA_START_ISO } from '@/features/dashboard/lib/olympia';
import { useOlympiaAccountAt } from '@/features/dashboard/services/olympiaApi';
import type { TranslationsT } from '@/features/dashboard/types';
import type { OlympiaDict } from './dict';
import { formatAmount } from './format';
import { OlympiaStakesList, OlympiaTokensList } from './OlympiaAccountSections';
import { Stat } from './OlympiaParts';

const FIRST_DAY = OLYMPIA_START_ISO.slice(0, 10);
const LAST_DAY = OLYMPIA_END_ISO.slice(0, 10);

export function OlympiaAccountAtDate({ address, o, locale, calendarT, t, onCopy, copiedAddress }: {
  address: string; o: OlympiaDict; locale: string; calendarT?: CalendarTranslations;
  t?: Partial<TranslationsT>; onCopy: (v: string) => void; copiedAddress: string | null;
}) {
  const [day, setDay] = useState('');
  const { data: a, isLoading, isError } = useOlympiaAccountAt(address, day || null);
  return (
    <AtDateView
      day={day}
      onPick={setDay}
      calendarT={calendarT}
      locale={locale}
      minDate={FIRST_DAY}
      maxDate={LAST_DAY}
      text={{ pick: o.at_date_pick, desc: o.at_date_desc, empty: o.at_date_empty, loading: o.loading, error: o.error, state: o.at_date_state, stateVersion: o.state_version }}
      status={isLoading ? 'loading' : isError || !a ? 'error' : 'ready'}
      stateVersion={a?.stateVersion}
    >
      {a && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label={o.total_xrd} value={formatAmount(a.totals.totalXrd, locale)} tone="accent" />
            <Stat label={o.liquid_xrd} value={formatAmount(a.totals.liquidXrd, locale)} />
            <Stat label={o.staked_xrd} value={formatAmount(a.totals.stakedXrd, locale)} tone="primary" />
            <Stat label={o.unstaking_xrd} value={formatAmount(a.totals.unstakingXrd + a.totals.pendingStakeXrd, locale)} tone="secondary" />
          </div>
          <OlympiaTokensList a={a} o={o} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} emptyText={o.at_date_no_tokens} />
          <OlympiaStakesList a={a} o={o} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} emptyText={o.at_date_no_stakes} />
        </>
      )}
    </AtDateView>
  );
}
