'use client';
/**
 * The parts of an Olympia account summary: headline numbers, the tokens and
 * stakes it held when Olympia ended, and its activity. Shared by the Olympia
 * account card and the "Olympia" tab of a Babylon account.
 */
import React from 'react';
import { SafeImage } from '@/components/ui/SafeImage';
import type { OlympiaAccountSummary } from '@/types/olympia';
import { endOfOlympia, type OlympiaDict } from './dict';
import { formatAmount, formatDate, formatDecimal } from './format';
import { BabylonRef, Empty, OlympiaRef, Section, Stat, TokenRef } from './OlympiaParts';

export function OlympiaAccountStats({ a, o, locale }: { a: OlympiaAccountSummary; o: OlympiaDict; locale: string }) {
  // Balances are what the account held when Olympia ended; counts and rewards
  // add up everything until then.
  const end = endOfOlympia(o, locale);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <Stat label={o.total_xrd} value={formatAmount(a.totals.totalXrd, locale)} tone="accent" hint={end.at} />
      <Stat label={o.liquid_xrd} value={formatAmount(a.totals.liquidXrd, locale)} hint={end.at} />
      <Stat label={o.staked_xrd} value={formatAmount(a.totals.stakedXrd, locale)} tone="primary" hint={end.at} />
      <Stat label={o.unstaking_xrd} value={formatAmount(a.totals.unstakingXrd + a.totals.pendingStakeXrd, locale)} tone="secondary" hint={end.at} />
      <Stat label={o.tx_count} value={a.activity.txCount.toLocaleString(locale)} hint={end.until} />
      <Stat label={o.rewards_delegator} value={formatAmount(a.rewards.delegatorXrd + a.rewards.validatorFeeXrd, locale)} tone="accent" hint={end.until} />
    </div>
  );
}

export function OlympiaIdentity({ a, o, locale }: { a: OlympiaAccountSummary; o: OlympiaDict; locale: string }) {
  const end = endOfOlympia(o, locale);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-1.5 border-b border-[var(--color-card-border)]/50 last:border-b-0 min-w-0">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] sm:w-48 shrink-0">{label}</span>
      <span className="min-w-0 text-xs">{value}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-1">
      {row(o.olympia_address, <OlympiaRef value={a.address} locale={locale} full />)}
      {row(o.babylon_address, <BabylonRef value={a.babylonAddress} locale={locale} full />)}
      {row(o.public_key, <span className="font-mono break-all text-[var(--color-text-main)]">{a.publicKey}</span>)}
      {row(o.first_tx, a.activity.firstTx ? formatDate(a.activity.firstTx.timestamp, locale) : '—')}
      {row(o.last_tx, a.activity.lastTx ? formatDate(a.activity.lastTx.timestamp, locale) : '—')}
      {row(o.fees_paid, <span className="font-mono">{formatAmount(a.activity.feesPaidXrd, locale, 4)} XRD</span>)}
      {row(o.rewards_delegator_earned, <span className="font-mono">{formatAmount(a.rewards.delegatorXrd, locale)} XRD <span className="text-[var(--color-text-muted)]">· {end.until}</span></span>)}
      {a.rewards.validatorFeeXrd > 0 && row(o.rewards_fee, <span className="font-mono">{formatAmount(a.rewards.validatorFeeXrd, locale)} XRD <span className="text-[var(--color-text-muted)]">· {end.until}</span></span>)}
    </div>
  );
}

export function OlympiaTokensList({ a, o, locale }: { a: OlympiaAccountSummary; o: OlympiaDict; locale: string }) {
  const all = [...(a.xrd ? [a.xrd] : []), ...a.tokens];
  if (all.length === 0) return <Empty text={o.no_tokens} />;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
      {all.map((t) => (
        <li key={t.rri} className="flex items-center gap-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-2 min-w-0">
          {t.iconUrl
            ? <SafeImage src={t.iconUrl} alt={t.symbol} fallbackName={t.symbol} className="size-7 rounded-full object-cover shrink-0" />
            : <span className="size-7 rounded-full bg-[var(--color-card-border)] shrink-0 grid place-items-center text-[9px] font-black">{t.symbol.slice(0, 3)}</span>}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 min-w-0">
              <TokenRef rri={t.rri} symbol={t.symbol} locale={locale} />
              {t.name && <span className="text-[10px] text-[var(--color-text-muted)] truncate">{t.name}</span>}
            </span>
            <span className="block text-sm font-mono font-bold text-[var(--color-text-main)] truncate" title={t.amount}>{formatDecimal(t.amount, locale, 4)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function OlympiaStakesList({ a, o, locale }: { a: OlympiaAccountSummary; o: OlympiaDict; locale: string }) {
  if (a.stakes.length === 0) return <Empty text={o.no_stakes} />;
  const th = 'py-2 px-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap';
  return (
    <div className="overflow-x-auto custom-scrollbar rounded-xl border border-[var(--color-card-border)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-surface)] border-b border-[var(--color-card-border)]">
          <tr>
            <th className={th}>{o.validator}</th>
            <th className={`${th} text-right`}>{o.staked_xrd}</th>
            <th className={`${th} text-right`}>{o.pending_stake_xrd}</th>
            <th className={`${th} text-right`}>{o.unstaking_xrd}</th>
          </tr>
        </thead>
        <tbody>
          {a.stakes.map((s) => (
            <tr key={s.validatorAddress} className="border-b border-[var(--color-card-border)]/50 last:border-b-0">
              <td className="py-2 px-3">
                <span className="flex flex-col min-w-0">
                  {s.validatorName && <span className="font-semibold text-[var(--color-text-main)] truncate">{s.validatorName}</span>}
                  <OlympiaRef value={s.validatorAddress} locale={locale} />
                </span>
              </td>
              <td className="py-2 px-3 text-right font-mono font-bold text-[var(--color-primary)]">{formatAmount(s.stakedXrd, locale)}</td>
              <td className="py-2 px-3 text-right font-mono">{formatAmount(s.pendingStakeXrd, locale)}</td>
              <td className="py-2 px-3 text-right font-mono">{formatAmount(s.pendingUnstakeXrd + s.exitingXrd, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How an Olympia account was controlled (one key) and the Babylon account that key moved to. */
export function OlympiaAccountSecurity({ a, o, locale }: { a: OlympiaAccountSummary; o: OlympiaDict; locale: string }) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-1.5 border-b border-[var(--color-card-border)]/50 last:border-b-0 min-w-0">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] sm:w-48 shrink-0">{label}</span>
      <span className="min-w-0 text-xs">{value}</span>
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">{o.account_security_desc}</p>
      <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-1">
        {row(o.account_security_key, <span className="font-semibold text-[var(--color-text-main)]">{o.account_security_one_key}</span>)}
        {row(o.public_key, <span className="font-mono break-all text-[var(--color-text-main)]">{a.publicKey}</span>)}
        {row(o.babylon_address, <BabylonRef value={a.babylonAddress} locale={locale} full />)}
      </div>
    </div>
  );
}

/** Everything above, stacked: the body of the "Olympia" tab and of the account card's summary. */
export function OlympiaAccountOverview({ a, o, locale, showIdentity = true }: { a: OlympiaAccountSummary; o: OlympiaDict; locale: string; showIdentity?: boolean }) {
  return (
    <div className="space-y-5">
      <Section title={o.final_state}><OlympiaAccountStats a={a} o={o} locale={locale} /></Section>
      {showIdentity && <OlympiaIdentity a={a} o={o} locale={locale} />}
      <Section title={o.tokens_tab}><OlympiaTokensList a={a} o={o} locale={locale} /></Section>
      <Section title={o.stakes_tab}><OlympiaStakesList a={a} o={o} locale={locale} /></Section>
    </div>
  );
}
