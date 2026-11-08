'use client';
import React from 'react';
import { Landmark } from 'lucide-react';
import type { AccountCardProps } from '../types/components.types';
import type { TranslationsT } from '@/features/dashboard/types';
import { EntityCardFrame } from '../components/EntityCardFrame';
import { PanelRawTab } from '../components/EntityPanelShared';
import { FundsFlowLoading, FundsFlowView } from '../components/AccountFundsFlowTab';
import { useOlympiaAccount, useOlympiaFunds } from '@/features/dashboard/services/olympiaApi';
import type { OlympiaAccountSummary } from '@/types/olympia';
import { fill, olympiaDict, type OlympiaDict } from './dict';
import { formatAmount } from './format';
import { OlympiaAccountSecurity, OlympiaAccountStats, OlympiaIdentity, OlympiaStakesList, OlympiaTokensList } from './OlympiaAccountSections';
import { OlympiaRewardsPanel } from './OlympiaRewardsPanel';
import { OlympiaTxTable } from './OlympiaTxTable';
import { OlympiaCsvButton } from './OlympiaCsvButton';
import { ErrorText, OlympiaBadge, Section, SourceNote } from './OlympiaParts';

/** Olympia transfers of an account, drawn like the Babylon funds flow. */
export function OlympiaFundsPanel({ address, o, tt, locale, copiedAddress, onCopy }: {
  address: string; o: OlympiaDict; tt?: Partial<TranslationsT['dashboard']['transactions']>; locale: string; copiedAddress: string | null; onCopy: (v: string) => void;
}) {
  const text = tt?.account_summary?.funds;
  const { data, isLoading, isError } = useOlympiaFunds(address);
  if (isLoading) return <FundsFlowLoading text={text} />;
  if (isError || !data) return <ErrorText text={o.error} />;
  return (
    <FundsFlowView
      flow={data}
      exportFor={data.olympiaAddress}
      network="mainnet"
      locale={locale}
      text={text}
      copiedAddress={copiedAddress}
      onCopy={onCopy}
      extraNote={<p className="text-[11px] text-[var(--color-text-muted)]">{fill(o.funds_desc, { address: `${data.olympiaAddress.slice(0, 14)}…`, n: 5000 })}</p>}
    />
  );
}

function facts(a: OlympiaAccountSummary, o: OlympiaDict, locale: string) {
  return [
    { label: o.total_xrd, value: formatAmount(a.totals.totalXrd, locale), tone: 'accent' as const },
    { label: o.staked_xrd, value: formatAmount(a.totals.stakedXrd, locale), tone: 'primary' as const },
    { label: o.tokens_count, value: (a.tokens.length + (a.xrd ? 1 : 0)).toLocaleString(locale) },
    { label: o.tx_count, value: a.activity.txCount.toLocaleString(locale) },
    { label: o.rewards_delegator, value: formatAmount(a.rewards.delegatorXrd + a.rewards.validatorFeeXrd, locale), tone: 'accent' as const },
  ];
}

/** The card of an Olympia account (`rdx1…`), found by the search box. */
export function OlympiaAccountCard({ address, isExpanded, onExpand, onCopy, copiedAddress, t, locale, isModal, headless }: AccountCardProps) {
  const tt = t?.dashboard?.transactions;
  const o = olympiaDict(tt);
  const { data: a } = useOlympiaAccount(address);
  if (!a) return null;
  return (
    <EntityCardFrame
      address={address}
      avatar={<Landmark className="size-8" style={{ color: 'var(--color-accent)' }} />}
      badge={<OlympiaBadge o={o} />}
      addressActions={<OlympiaCsvButton address={address} />}
      facts={facts(a, o, locale)}
      isExpanded={isExpanded}
      onExpand={onExpand}
      onCopy={onCopy}
      copiedAddress={copiedAddress}
      isModal={isModal}
      closeLabel={t?.dashboard?.reading?.close}
      headless={headless}
      tabs={[
        // The Babylon account card's tabs that make sense on Olympia, in the same
        // order. NFTs, pool units, lockers, deposit rules, metadata and roles
        // did not exist there.
        { key: 'summary', label: o.summary_tab, render: () => <div className="space-y-4"><Section title={o.final_state}><OlympiaAccountStats a={a} o={o} locale={locale} /></Section><OlympiaIdentity a={a} o={o} locale={locale} /><SourceNote o={o} /></div> },
        { key: 'staking', label: o.account_staking_tab ?? 'Staking', render: () => <Section title={o.stakes_tab}><OlympiaStakesList a={a} o={o} locale={locale} /></Section> },
        { key: 'tokens', label: o.tokens_tab, render: () => <OlympiaTokensList a={a} o={o} locale={locale} /> },
        { key: 'transactions', label: o.transactions_tab, render: () => <OlympiaTxTable address={address} o={o} locale={locale} /> },
        { key: 'funds', label: o.funds_tab, render: () => <OlympiaFundsPanel address={address} o={o} tt={tt} locale={locale} copiedAddress={copiedAddress} onCopy={onCopy} /> },
        { key: 'rewards', label: o.rewards_tab, render: () => <OlympiaRewardsPanel a={a} o={o} locale={locale} /> },
        { key: 'security', label: o.account_security_tab ?? '', render: () => <OlympiaAccountSecurity a={a} o={o} locale={locale} /> },
        { key: 'raw', label: o.raw_tab, tooltip: o.raw_tooltip, render: () => <PanelRawTab data={a} tt={t?.dashboard?.transactions} onCopy={onCopy} copiedAddress={copiedAddress} /> },
      ]}
    />
  );
}
