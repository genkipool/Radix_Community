'use client';
/**
 * The parts of an Olympia account summary: headline numbers, the tokens and
 * stakes it held when Olympia ended, and its activity. Shared by the Olympia
 * account card and the "Olympia" tab of a Babylon account.
 */
import React, { useState } from 'react';
import type { TranslationsT } from '@/features/dashboard/types';
import { ENTITY_KINDS } from '@/features/dashboard/lib/entityKinds';
import { AssetListSection, AssetRowCard } from '../components/AssetRowCard';
import { ExpandedEntityPanel, ResourceCardHeader, StakeColumns, resourceCardFrameClass, type StakeColumn } from '../components/ResourceCardParts';
import { OlympiaResourceInlinePanel } from './OlympiaResourcePanel';
import { OlympiaValidatorCard } from './OlympiaValidatorCard';
import type { OlympiaAccountSummary, OlympiaStake, OlympiaTokenAmount } from '@/types/olympia';
import { endOfOlympia, type OlympiaDict } from './dict';
import { formatAmount, formatDate, formatDecimal } from './format';
import { BabylonRef, OlympiaRef, Section, Stat } from './OlympiaParts';

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

/** Shared by the token and stake lists: what opening an entity in place needs. */
interface EntityListProps {
  o: OlympiaDict;
  locale: string;
  t?: Partial<TranslationsT>;
  onCopy: (v: string) => void;
  copiedAddress: string | null;
  emptyText?: string;
}

function EmptyList({ text }: { text?: string }) {
  // As the Babylon account card says an empty tab.
  return <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">{text}</p>;
}

function OlympiaTokenRow({ token, locale, t, onCopy, copiedAddress }: { token: OlympiaTokenAmount } & Omit<EntityListProps, 'o' | 'emptyText'>) {
  const [expanded, setExpanded] = useState(false);
  return (
    <AssetRowCard
      address={token.rri}
      name={token.name || token.symbol}
      symbol={token.symbol}
      iconUrl={token.iconUrl}
      amountText={formatDecimal(token.amount, locale, 4)}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      onCopy={onCopy}
      copiedAddress={copiedAddress}
    >
      <OlympiaResourceInlinePanel rri={token.rri} t={t} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} />
    </AssetRowCard>
  );
}

/** The tokens an Olympia account held, drawn as the Babylon account card's Tokens tab. */
export function OlympiaTokensList({ a, o, locale, t, onCopy, copiedAddress, emptyText }: { a: Pick<OlympiaAccountSummary, 'xrd' | 'tokens'> } & EntityListProps) {
  const all = [...(a.xrd ? [a.xrd] : []), ...a.tokens];
  const tt = t?.dashboard?.transactions;
  if (all.length === 0) return <EmptyList text={emptyText ?? o.no_tokens} />;
  return (
    <AssetListSection title={`${tt?.account_summary?.tokens_tab || o.tokens_tab} (${all.length})`}>
      {all.map((token) => (
        <OlympiaTokenRow key={token.rri} token={token} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} />
      ))}
    </AssetListSection>
  );
}

function OlympiaStakeCard({ s, o, locale, t, onCopy, copiedAddress }: { s: OlympiaStake } & Omit<EntityListProps, 'emptyText'>) {
  const [expanded, setExpanded] = useState(false);
  const tt = t?.dashboard?.transactions;
  const unstaking = s.pendingUnstakeXrd + s.exitingXrd;
  // The Babylon stake columns; pending stake is Olympia's (XRD staked this epoch), shown when there is some.
  const columns: StakeColumn[] = [
    { label: tt?.stake_history?.stake || tt?.account_summary?.stake_xrd || o.staked_xrd, amount: s.stakedXrd, unit: 'XRD' },
    ...(s.pendingStakeXrd > 0 ? [{ label: o.pending_stake_xrd, amount: s.pendingStakeXrd, tone: 'text-[var(--color-primary)]', unit: 'XRD' }] : []),
    { label: tt?.stake_history?.unstake || tt?.account_summary?.unstake_xrd || o.unstaking_xrd, amount: unstaking, tone: 'text-[var(--color-warning)]', unit: 'XRD' },
  ];
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.getSelection()?.toString()) return;
    setExpanded((v) => !v);
  };
  const address = s.validatorAddress;
  return (
    <div className={`flex flex-col ${resourceCardFrameClass(expanded)} rounded-xl`}>
      <ResourceCardHeader
        address={address}
        shortAddress={address.length > 20 ? `${address.slice(0, 10)}...${address.slice(-6)}` : address}
        name={s.validatorName}
        nameColor={ENTITY_KINDS.validator.color}
        onToggle={toggle}
        onCopy={onCopy}
        copiedAddress={copiedAddress}
        expanded={expanded}
        right={<StakeColumns columns={columns} locale={locale} />}
        copyLabel={tt?.copy_address}
      />
      <ExpandedEntityPanel expanded={expanded}>
        <OlympiaValidatorCard address={address} columns={1} isExpanded headless onCopy={onCopy} copiedAddress={copiedAddress} t={t} network="mainnet" locale={locale} />
      </ExpandedEntityPanel>
    </div>
  );
}

/** The stakes of an Olympia account, drawn as the Babylon account card's Staking tab. */
export function OlympiaStakesList({ a, o, locale, t, onCopy, copiedAddress, emptyText }: { a: Pick<OlympiaAccountSummary, 'stakes'> } & EntityListProps) {
  const tt = t?.dashboard?.transactions;
  if (a.stakes.length === 0) return <EmptyList text={emptyText ?? o.no_stakes} />;
  return (
    <div className="space-y-4">
      <h4 className="text-[11px] font-black uppercase mb-3 tracking-wider text-[var(--color-text-muted)] mt-4">
        {tt?.account_summary?.staking_validators_title || o.validator} <span className="ml-1 opacity-50">({a.stakes.length})</span>
      </h4>
      <div className="grid grid-cols-1 gap-2 items-start">
        {a.stakes.map((s) => (
          <OlympiaStakeCard key={s.validatorAddress} s={s} o={o} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} />
        ))}
      </div>
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
export function OlympiaAccountOverview({ a, o, locale, showIdentity = true, t, onCopy, copiedAddress }: {
  a: OlympiaAccountSummary; o: OlympiaDict; locale: string; showIdentity?: boolean;
  t?: Partial<TranslationsT>; onCopy: (v: string) => void; copiedAddress: string | null;
}) {
  return (
    <div className="space-y-5">
      <Section title={o.final_state}><OlympiaAccountStats a={a} o={o} locale={locale} /></Section>
      {showIdentity && <OlympiaIdentity a={a} o={o} locale={locale} />}
      <OlympiaTokensList a={a} o={o} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} />
      <OlympiaStakesList a={a} o={o} locale={locale} t={t} onCopy={onCopy} copiedAddress={copiedAddress} />
    </div>
  );
}
