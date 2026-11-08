'use client';
/**
 * In a Babylon account's security tab, under "who controls it": the Olympia
 * account it comes from (same key) in a few rows drawn like the ledger's rows
 * above them. Nothing when the account did not exist on Olympia.
 */
import React from 'react';
import type { TranslationsT } from '@/features/dashboard/types';
import { useOlympiaAccount, useOlympiaLink } from '@/features/dashboard/services/olympiaApi';
import { endOfOlympia, olympiaDict } from './dict';
import { formatAmount, formatDate } from './format';
import { OlympiaRef } from './OlympiaParts';

/** The label + value line of the security report (AccountSecurityReportView's Row). */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-1">
      <span className="text-xs shrink-0 sm:w-56 text-[var(--color-text-muted)]">{label}</span>
      <span className="flex items-center gap-1.5 min-w-0 text-xs font-semibold text-[var(--color-text-main)] break-all">{children}</span>
    </div>
  );
}

export function OlympiaControlRows({ babylonAddress, network, tt, locale }: {
  babylonAddress: string;
  network: string;
  tt?: Partial<TranslationsT['dashboard']['transactions']>;
  locale: string;
}) {
  const o = olympiaDict(tt);
  const { data: link } = useOlympiaLink(babylonAddress, network);
  const { data: a } = useOlympiaAccount(link ? babylonAddress : null);
  if (!link) return null;
  const end = endOfOlympia(o, locale);
  return (
    <div className="space-y-0.5">
      <Row label={o.olympia_address}><OlympiaRef value={link.olympiaAddress} locale={locale} full /></Row>
      {a && (
        <>
          <Row label={o.first_tx}>{a.activity.firstTx ? formatDate(a.activity.firstTx.timestamp, locale) : '-'}</Row>
          <Row label={o.last_tx}>{a.activity.lastTx ? formatDate(a.activity.lastTx.timestamp, locale) : '-'}</Row>
          <Row label={o.tx_count}>{a.activity.txCount.toLocaleString(locale)}</Row>
          <Row label={o.security_final_xrd}>
            {formatAmount(a.totals.totalXrd, locale)} XRD
            <span className="font-normal text-[var(--color-text-muted)]">· {end.at}</span>
          </Row>
        </>
      )}
    </div>
  );
}
