'use client';
import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import type { AccountCardProps } from '../types/components.types';
import { EntityCardFrame } from '../components/EntityCardFrame';
import { PanelConfigurationTab, PanelMetadataTab, PanelRawTab, SummaryInlineRow } from '../components/EntityPanelShared';
import type { ConfigEntry, MetadataItem } from '@/features/dashboard/types/shared.types';
import type { TranslationsT } from '@/features/dashboard/types';
import { StakeEvolutionChart, StakeHistoryChart } from '@/features/dashboard/staking/components/ValidatorStakeCharts';
import { OLYMPIA_END_ISO } from '@/features/dashboard/lib/olympia';
import { olympiaApi, useOlympiaValidator } from '@/features/dashboard/services/olympiaApi';
import type { OlympiaValidator } from '@/types/olympia';
import { endOfOlympia, fill, olympiaDict, type OlympiaDict } from './dict';
import { formatAmount } from './format';
import { OlympiaRewardsCsv } from './OlympiaRewardsCsv';
import { OlympiaCsvButton } from './OlympiaCsvButton';
import { Empty, FilterPills, OlympiaBadge, OlympiaRef, Section, SourceNote, Stat } from './OlympiaParts';

/**
 * An Olympia validator's own descriptive fields (the name and web its operator
 * registered) as Babylon metadata entries, so the Babylon metadata tab draws
 * them. The operator could change them, so they are not shown as locked.
 */
export function olympiaValidatorMetadata(v: OlympiaValidator): MetadataItem[] {
  const item = (key: string, typed: MetadataItem['value']['typed']): MetadataItem => ({
    key, value: { typed }, is_locked: false, last_updated_at_state_version: 0,
  });
  return [
    v.name ? item('name', { type: 'String', value: v.name }) : null,
    v.url ? item('info_url', { type: 'Url', value: v.url }) : null,
  ].filter((m): m is MetadataItem => m !== null);
}

/**
 * Who could do what with an Olympia validator, as Babylon role entries.
 * Olympia had no roles: every change to the validator (name, web, fee,
 * registration, delegation) was signed by its node key, the fee went to the
 * owner, and staking was open to anyone or, with delegation closed, to the
 * owner alone. None of it could be reassigned.
 */
export function olympiaValidatorConfig(v: OlympiaValidator, tt: Partial<TranslationsT['dashboard']['transactions']> | undefined, o: OlympiaDict): ConfigEntry[] {
  const open = v.allowDelegation !== false;
  return [
    { name: 'validator_update', resolution: o.role_node_key, updatable: false, desc: o.role_validator_update, group: 'main', ruleAddress: v.publicKey ?? null },
    { name: 'fee_receiver', resolution: tt?.role_resolution_owner ?? '', updatable: false, desc: o.role_fee_receiver, group: 'main', ruleAddress: v.owner },
    { name: 'stake', resolution: open ? (tt?.role_resolution_allow_all ?? '') : (tt?.role_resolution_owner ?? ''), updatable: false, desc: o.role_stake, group: 'roles', ruleAddress: open ? null : v.owner },
  ];
}

/** A web link that does not open the card it sits on, as the Babylon validator card shows it. */
function WebLink({ url }: { url: string | null }) {
  if (!url) return <>-</>;
  return (
    <a
      href={url.startsWith('http') ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="hover:underline hover:text-[var(--color-primary)]"
      onClick={(e) => e.stopPropagation()}
    >
      {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
    </a>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="pb-2">
      <h3 className="text-[10.5px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</h3>
    </div>
  );
}

/**
 * The validator's summary in the rows of the Babylon validator panel
 * (ValidatorSummaryMetrics): its profile, its delegation figures as Olympia
 * ended, and how its stake moved over the whole of Olympia.
 */
function Details({ v, o, t, locale, onCopy, copiedAddress }: {
  v: OlympiaValidator; o: OlympiaDict; t?: AccountCardProps['t']; locale: string; onCopy: (v: string) => void; copiedAddress: string | null;
}) {
  const dd = t?.dashboard?.details;
  const end = endOfOlympia(o, locale);
  const pct = (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
  const evolution = (v.stakeHistory ?? []).map((d) => ({ date: d.day, totalStake: d.stakeXrd }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
        <dl className="flex flex-col">
          <SectionHeader label={o.summary_tab} />
          <SummaryInlineRow label={o.validator_name} value={v.name ?? '-'} />
          <SummaryInlineRow label={o.url}><span className="text-xs font-medium truncate"><WebLink url={v.url} /></span></SummaryInlineRow>
          <SummaryInlineRow label={o.owner} value={v.owner ?? '-'} mono copyable={!!v.owner} onCopy={() => v.owner && onCopy(v.owner)} isCopied={!!v.owner && copiedAddress === v.owner} />
          <SummaryInlineRow label={o.registered} value={v.isRegistered === null ? '-' : v.isRegistered ? o.yes : o.no} />
          <SummaryInlineRow label={o.delegation} value={v.allowDelegation === null ? '-' : v.allowDelegation ? o.allowed : o.closed} />
        </dl>
        <dl className="flex flex-col">
          <SectionHeader label={dd?.validator_staking_summary ?? ''} />
          <SummaryInlineRow
            label={o.validator_stake}
            value={`${formatAmount(v.totalStakedXrd, locale)} XRD`}
            secondaryValue={v.networkSharePercent != null ? `${pct(v.networkSharePercent)} ${dd?.of_the_network ?? ''} · ${end.at}` : end.at}
            mono
          />
          <SummaryInlineRow label={dd?.validator_delegators ?? o.validator_delegators} value={v.delegators.toLocaleString(locale)} />
          {v.ownerStakeXrd != null && <SummaryInlineRow label={dd?.validator_owner_stake ?? ''} value={`${formatAmount(v.ownerStakeXrd, locale)} XRD`} mono />}
          {v.feePercent !== null && <SummaryInlineRow label={dd?.validator_nominal_fee ?? o.validator_fee} value={pct(v.feePercent)} />}
          {v.xrdPerStakeUnit != null && (
            <SummaryInlineRow label={o.stake_unit_factor} value={`1 = ${Number(v.xrdPerStakeUnit.toFixed(8)).toLocaleString(locale, { maximumFractionDigits: 8 })} XRD`} mono />
          )}
        </dl>
      </div>
      {v.proposals && (
        <dl className="flex flex-col">
          <SectionHeader label={dd?.performance_total ?? ''} />
          <SummaryInlineRow label={dd?.uptime_total ?? ''} value={pct(v.proposals.uptimePercent)} secondaryValue={o.during_olympia} accentValue />
          <SummaryInlineRow label={dd?.proposals_made ?? ''} value={v.proposals.completed.toLocaleString(locale)} mono />
          <SummaryInlineRow label={dd?.proposals_missed ?? ''} value={v.proposals.missed.toLocaleString(locale)} mono />
        </dl>
      )}
      {evolution.length > 1 && (
        <div>
          <SectionHeader label={o.stake_evolution} />
          <StakeEvolutionChart data={evolution} t={t} locale={locale} />
        </div>
      )}
      <StakeActivity v={v} o={o} t={t} locale={locale} />
      <SourceNote o={o} />
    </div>
  );
}

type ActivityView = 'days' | 'months';

/**
 * XRD staked to and unstaked from the validator, in Babylon's stake activity
 * chart: the last 30 days of Olympia (as Babylon shows its last 30), or the
 * whole of Olympia month by month. Olympia had no claim step, so that series
 * stays empty.
 */
function StakeActivity({ v, o, t, locale }: { v: OlympiaValidator; o: OlympiaDict; t?: AccountCardProps['t']; locale: string }) {
  const [view, setView] = useState<ActivityView>('days');
  const activity = v.stakeActivity ?? [];
  if (activity.length === 0) return null;

  const data = view === 'days' ? lastDays(activity, 30) : byMonth(activity);
  const empty = data.every((d) => d.stake === 0 && d.unstake === 0);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader label={o.stake_activity} />
        <div className="flex flex-wrap items-center gap-3 pb-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-muted)]"><span className="size-2 rounded-full bg-[#22c55e]" />{t?.stakes?.stake}</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-muted)]"><span className="size-2 rounded-full bg-[#f59e0b]" />{t?.stakes?.unstake}</span>
          <FilterPills
            value={view}
            onChange={setView}
            options={[{ key: 'days', label: o.activity_last_30_days }, { key: 'months', label: o.activity_by_month }]}
          />
        </div>
      </div>
      {empty
        ? <p className="py-8 text-center text-xs text-[var(--color-text-muted)]">{t?.stakes?.no_activity}</p>
        : <StakeHistoryChart data={data} t={t} locale={locale} />}
    </div>
  );
}

const DAY_MS = 86_400_000;

/** The last `n` days of Olympia, every day present (zero when nothing moved). */
export function lastDays(activity: { day: string; stake: number; unstake: number }[], n: number) {
  const byDay = new Map(activity.map((a) => [a.day, a]));
  const end = Date.parse(`${OLYMPIA_END_ISO.slice(0, 10)}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(end - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10);
    const a = byDay.get(day);
    return { date: day, stake: a?.stake ?? 0, unstake: a?.unstake ?? 0, claim: 0 };
  });
}

/** Month totals from the first movement to the end of Olympia, every month present. */
export function byMonth(activity: { day: string; stake: number; unstake: number }[]) {
  const totals = new Map<string, { stake: number; unstake: number }>();
  for (const a of activity) {
    const key = a.day.slice(0, 7);
    const m = totals.get(key) ?? { stake: 0, unstake: 0 };
    m.stake += a.stake;
    m.unstake += a.unstake;
    totals.set(key, m);
  }
  const out: { date: string; stake: number; unstake: number; claim: number }[] = [];
  let [y, m] = activity[0].day.split('-').map(Number);
  const [y1, m1] = OLYMPIA_END_ISO.slice(0, 7).split('-').map(Number);
  while (y < y1 || (y === y1 && m <= m1)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const t = totals.get(key);
    out.push({ date: `${key}-15`, stake: t?.stake ?? 0, unstake: t?.unstake ?? 0, claim: 0 });
    if (m === 12) { y += 1; m = 1; } else { m += 1; }
  }
  return out;
}

/**
 * The validator's delegators when Olympia ended, biggest first, as plain rows.
 * The card arrives with the first 50; "show more" reads the next page.
 */
function Delegators({ v, o, locale }: { v: OlympiaValidator; o: OlympiaDict; locale: string }) {
  const [list, setList] = useState(v.topDelegators);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  if (list.length === 0) return <Empty text="-" />;
  const remaining = v.delegators - list.length;

  const more = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const page = await olympiaApi.validatorDelegators(v.address, list.length, PAGE);
      setList((current) => [...current, ...(page?.items ?? [])]);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ol className="divide-y divide-[var(--color-card-border)]/50">
        {list.map((d, i) => (
          <li key={d.address} className="flex items-center justify-between gap-3 py-2 text-xs">
            <span className="flex items-center gap-2 min-w-0"><span className="w-8 text-right text-[var(--color-text-muted)]">{i + 1}</span><OlympiaRef value={d.address} locale={locale} /></span>
            <span className="text-right whitespace-nowrap font-mono font-bold">
              {formatAmount(d.stakedXrd, locale)} XRD
              {v.totalStakedXrd > 0 && <span className="ml-2 text-[10px] font-normal text-[var(--color-text-muted)]">{((d.stakedXrd / v.totalStakedXrd) * 100).toLocaleString(locale, { maximumFractionDigits: 2 })}%</span>}
            </span>
          </li>
        ))}
      </ol>
      {remaining > 0 && (
        <div className="flex items-center gap-3 pt-3 text-xs">
          <button type="button" onClick={(e) => { e.stopPropagation(); void more(); }} disabled={loading} className="text-[var(--color-primary)] hover:underline disabled:opacity-50">
            {loading ? o.loading : fill(o.show_more, { n: Math.min(PAGE, remaining).toLocaleString(locale) })}
          </button>
          {failed && <span className="text-[var(--color-danger)]">{o.error}</span>}
        </div>
      )}
    </div>
  );
}

/** Delegators read per "show more". */
const PAGE = 50;

function Rewards({ v, o, locale }: { v: OlympiaValidator; o: OlympiaDict; locale: string }) {
  return (
    <div className="space-y-4">
      <Section title={o.rewards_owner_title}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label={o.rewards_total_fee} value={`${formatAmount(v.rewards.ownerFeeXrd, locale)} XRD`} tone="primary" hint={endOfOlympia(o, locale).until} />
          <Stat label={o.rewards_total_delegators} value={`${formatAmount(v.rewards.delegatorsXrd, locale)} XRD`} tone="accent" hint={endOfOlympia(o, locale).until} />
          <Stat label={o.rewards_year} value={v.rewards.years.join(' · ') || '—'} />
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)]">{o.rewards_desc}</p>
      </Section>
      <OlympiaRewardsCsv subject="validator" address={v.address} years={v.rewards.years} o={o} locale={locale} />
    </div>
  );
}

/** The card of an Olympia validator (`rv1…`). */
export function OlympiaValidatorCard({ address, isExpanded, onExpand, onCopy, copiedAddress, t, locale, isModal, headless }: AccountCardProps) {
  const o = olympiaDict(t?.dashboard?.transactions);
  const { data: v } = useOlympiaValidator(address);
  // The archive has no icons. A Babylon validator with the same node key is the
  // same operator, so its icon is this validator's too.
  const { data: babylon } = useValidatorsQuery('mainnet');
  const key = v?.publicKey?.toLowerCase();
  const icon = key ? babylon?.validators?.find((b) => b.publicKey?.toLowerCase() === key)?.iconUrl : undefined;
  if (!v) return null;
  return (
    <EntityCardFrame
      address={address}
      avatar={icon
        ? <SafeImage src={icon} alt={v.name ?? address} fallbackName={v.name ?? address} className="size-8 object-cover rounded-xl" />
        : <ShieldCheck className="size-8" style={{ color: 'var(--color-accent)' }} />}
      badge={<OlympiaBadge o={o} />}
      addressActions={<OlympiaCsvButton address={address} />}
      facts={[
        { label: o.validator_name, value: v.name ?? '—', tone: 'secondary' },
        { label: o.validator_stake, value: `${formatAmount(v.totalStakedXrd, locale, 0)} XRD`, tone: 'accent' },
        { label: o.validator_fee, value: v.feePercent === null ? '—' : `${v.feePercent.toLocaleString(locale, { maximumFractionDigits: 2 })}%` },
        ...(v.proposals ? [{ label: t?.dashboard?.details?.validator_uptime ?? '', value: `${v.proposals.uptimePercent.toLocaleString(locale, { maximumFractionDigits: 2 })}%`, tone: 'accent' as const }] : []),
        { label: o.validator_delegators, value: v.delegators.toLocaleString(locale) },
        { label: t?.dashboard?.entity_cards?.web ?? o.url, value: <WebLink url={v.url} /> },
      ]}
      isExpanded={isExpanded}
      onExpand={onExpand}
      onCopy={onCopy}
      copiedAddress={copiedAddress}
      isModal={isModal}
      closeLabel={t?.dashboard?.reading?.close}
      headless={headless}
      tabs={[
        { key: 'summary', label: o.summary_tab, render: () => <Details v={v} o={o} t={t} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} /> },
        { key: 'delegators', label: o.delegators_tab, render: () => <Delegators v={v} o={o} locale={locale} /> },
        { key: 'rewards', label: o.rewards_tab, render: () => <Rewards v={v} o={o} locale={locale} /> },
        { key: 'metadata', label: t?.dashboard?.transactions?.resource_panel_metadata ?? '', render: () => <PanelMetadataTab metadataItems={olympiaValidatorMetadata(v)} tt={t?.dashboard?.transactions} onCopy={onCopy} copiedAddress={copiedAddress} /> },
        { key: 'configuration', label: t?.dashboard?.transactions?.resource_panel_configuration ?? '', render: () => <PanelConfigurationTab configEntries={olympiaValidatorConfig(v, t?.dashboard?.transactions, o)} tt={t?.dashboard?.transactions} onCopy={onCopy} copiedAddress={copiedAddress} /> },
        { key: 'raw', label: o.raw_tab, tooltip: o.raw_tooltip, render: () => <PanelRawTab data={v} tt={t?.dashboard?.transactions} onCopy={onCopy} copiedAddress={copiedAddress} /> },
      ]}
    />
  );
}
