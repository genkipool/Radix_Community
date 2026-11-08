'use client';
/**
 * An Olympia token drawn like the Babylon resource panel (ResourceInlinePanel):
 * icon, name, symbol tag and short address with copy on top, the description
 * in italics, then label / value rows with no frame around them. Its holders
 * and its raw archive data are the other tabs.
 *
 * `OlympiaResourceSummary` is the summary alone (the token card's first tab);
 * `OlympiaResourceInlinePanel` is the whole panel that opens under a token row.
 */
import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { TokenBadge } from '@/components/ui/TokenBadge';
import type { TranslationsT } from '@/features/dashboard/types';
import { useOlympiaResource } from '@/features/dashboard/services/olympiaApi';
import type { OlympiaResource } from '@/types/olympia';
import type { ConfigEntry, MetadataItem } from '@/features/dashboard/types/shared.types';
import { PanelConfigurationTab, PanelMetadataTab, PanelRawTab, PanelTabBar } from '../components/EntityPanelShared';
import { olympiaDict, type OlympiaDict } from './dict';
import { formatDecimal } from './format';
import { BabylonRef, Empty, OlympiaRef } from './OlympiaParts';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

const DT = 'text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0';
const DD = 'text-xs font-semibold text-[var(--color-text-main)] min-w-0 text-right break-words';

function Row({ label, children, mono, tone }: { label?: string; children: React.ReactNode; mono?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={DT}>{label}</dt>
      <dd className={`${DD} ${mono ? 'font-mono' : ''} ${tone ?? ''}`}>{children}</dd>
    </div>
  );
}

export function OlympiaResourceSummary({ r, tt, o, locale, onCopy, copiedAddress }: {
  r: OlympiaResource; tt?: Tt; o: OlympiaDict; locale: string; onCopy: (v: string) => void; copiedAddress: string | null;
}) {
  const name = r.name || r.symbol;
  const amount = (v: string) => `${formatDecimal(v, locale, 6)} ${r.symbol}`;
  const copied = copiedAddress === r.rri;
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        {r.iconUrl
          ? <SafeImage src={r.iconUrl} alt={name} fallbackName={r.symbol} className="size-9 rounded-full shrink-0 object-cover border border-[var(--color-card-border)]" />
          : <div className="size-9 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-xs border border-[var(--color-primary)]/20 shrink-0">{r.symbol.slice(0, 2).toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-[var(--color-text-main)] truncate">{name}</span>
            <TokenBadge className="shrink-0">{r.symbol}</TokenBadge>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[200px]" title={r.rri}>{r.rri}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCopy(r.rri); }}
              className={`p-0.5 rounded transition-colors ${copied ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
              title={tt?.copy_address}
            >
              {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
            </button>
          </div>
        </div>
      </div>
      {r.description && <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4 italic border-l-2 border-[var(--color-primary)]/30 pl-3">{r.description}</p>}
      <div className="border-t border-[var(--color-card-border)] mb-4" />
      <dl className="space-y-3">
        <Row label={tt?.resource_panel_total_supply} mono>{amount(r.totalSupply)}</Row>
        <Row label={tt?.resource_panel_total_minted} mono tone="text-[var(--color-accent)]">+{amount(r.totalMinted)}</Row>
        {Number(r.totalBurnt) > 0 && <Row label={tt?.resource_panel_total_burned} mono tone="text-red-400">−{amount(r.totalBurnt)}</Row>}
        {r.granularity && <Row label={tt?.resource_panel_divisibility} mono>{r.granularity}</Row>}
        {r.isMutable !== null && <Row label={o.mutable}>{r.isMutable ? o.mutable_yes : o.mutable_no}</Row>}
        <Row label={o.holders}>{r.holders.toLocaleString(locale)}</Row>
        {r.owner && <Row label={o.owner}><OlympiaRef value={r.owner} locale={locale} /></Row>}
        <Row label={o.created_at_version} mono>{r.createdStateVersion.toLocaleString(locale)}</Row>
        {r.url && (
          <Row label={o.url}>
            <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()} className="text-[var(--color-primary)] hover:underline break-all">{r.url}</a>
          </Row>
        )}
        {r.babylonAddress && <Row label={o.babylon_resource}><BabylonRef value={r.babylonAddress} locale={locale} /></Row>}
      </dl>
    </div>
  );
}

/** The largest holders when Olympia ended, as plain rows. */
export function OlympiaResourceHolders({ r, locale }: { r: OlympiaResource; locale: string }) {
  if (r.topHolders.length === 0) return <Empty text="-" />;
  const supply = Number(r.totalSupply) || 0;
  return (
    <ol className="divide-y divide-[var(--color-card-border)]/50">
      {r.topHolders.map((h, i) => (
        <li key={h.address} className="flex items-center justify-between gap-3 py-2 text-xs">
          <span className="flex items-center gap-2 min-w-0"><span className="w-6 text-right text-[var(--color-text-muted)]">{i + 1}</span><OlympiaRef value={h.address} locale={locale} /></span>
          <span className="text-right whitespace-nowrap">
            <span className="font-mono font-bold">{formatDecimal(h.amount, locale, 4)}</span>
            {supply > 0 && <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">{((h.amountNum / supply) * 100).toLocaleString(locale, { maximumFractionDigits: 2 })}%</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * An Olympia token's descriptive fields as Babylon metadata entries, so the
 * Babylon metadata tab draws them. They were set when the token was created and
 * could never change, hence locked.
 */
export function olympiaResourceMetadata(r: OlympiaResource): MetadataItem[] {
  const item = (key: string, typed: MetadataItem['value']['typed']): MetadataItem => ({
    key, value: { typed }, is_locked: true, last_updated_at_state_version: r.createdStateVersion,
  });
  return [
    r.name ? item('name', { type: 'String', value: r.name }) : null,
    item('symbol', { type: 'String', value: r.symbol }),
    r.description ? item('description', { type: 'String', value: r.description }) : null,
    r.iconUrl ? item('icon_url', { type: 'Url', value: r.iconUrl }) : null,
    r.url ? item('info_url', { type: 'Url', value: r.url }) : null,
  ].filter((m): m is MetadataItem => m !== null);
}

/**
 * Who could do what with an Olympia token, as Babylon role entries. Olympia had
 * no role system: a mutable token's owner could mint and burn it, a fixed one
 * nobody could; anyone could hold and move it, and nothing could ever be
 * reassigned.
 */
export function olympiaResourceConfig(r: OlympiaResource, tt?: Tt): ConfigEntry[] {
  const owner = r.isMutable === true;
  const byOwner = owner ? (tt?.role_resolution_owner ?? '') : (tt?.role_resolution_deny_all ?? '');
  const anyone = tt?.role_resolution_allow_all ?? '';
  const nobody = tt?.role_resolution_deny_all ?? '';
  return [
    { name: 'minter', resolution: byOwner, updatable: false, desc: tt?.role_desc_minter ?? '', group: 'roles', ruleAddress: owner ? r.owner : null },
    { name: 'burner', resolution: byOwner, updatable: false, desc: tt?.role_desc_burner ?? '', group: 'roles', ruleAddress: owner ? r.owner : null },
    { name: 'withdrawer', resolution: anyone, updatable: false, desc: tt?.role_desc_withdrawer ?? '', group: 'roles' },
    { name: 'depositor', resolution: anyone, updatable: false, desc: tt?.role_desc_depositor ?? '', group: 'roles' },
    { name: 'metadata_setter', resolution: nobody, updatable: false, desc: tt?.role_desc_metadata_setter ?? '', group: 'metadata' },
  ];
}

type Tab = 'summary' | 'metadata' | 'configuration' | 'holders' | 'raw';

/** What opens under a token row of a transaction, as Babylon's ResourceInlinePanel. */
export function OlympiaResourceInlinePanel({ rri, t, locale, onCopy, copiedAddress }: {
  rri: string; t?: Partial<TranslationsT>; locale: string; onCopy: (v: string) => void; copiedAddress: string | null;
}) {
  const tt = t?.dashboard?.transactions;
  const o = olympiaDict(tt);
  const [tab, setTab] = useState<Tab>('summary');
  const { data: r, isLoading } = useOlympiaResource(rri);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: tt?.resource_panel_summary ?? '' },
    { key: 'metadata', label: tt?.resource_panel_metadata ?? '' },
    { key: 'configuration', label: tt?.resource_panel_configuration ?? '' },
    { key: 'holders', label: o.holders_tab },
    { key: 'raw', label: tt?.resource_panel_raw ?? '' },
  ];
  return (
    <div className="block w-full text-left border border-t-0 border-[var(--color-card-border)] rounded-b-xl overflow-hidden bg-[var(--color-surface)]" onClick={(e) => e.stopPropagation()} role="presentation">
      <PanelTabBar tabs={tabs} activeTab={tab} onTabChange={setTab} layoutId={`olympiaResourceTabs-${rri}`} />
      <div className="px-5 py-4">
        {isLoading ? (
          <p className="text-xs text-[var(--color-text-muted)] py-3">{o.loading}</p>
        ) : !r ? (
          <p className="text-xs text-[var(--color-text-muted)] py-3">{o.error}</p>
        ) : (
          <>
            {tab === 'summary' && <OlympiaResourceSummary r={r} tt={tt} o={o} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} />}
            {tab === 'metadata' && <PanelMetadataTab metadataItems={olympiaResourceMetadata(r)} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />}
            {tab === 'configuration' && <PanelConfigurationTab configEntries={olympiaResourceConfig(r, tt)} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />}
            {tab === 'holders' && <OlympiaResourceHolders r={r} locale={locale} />}
            {tab === 'raw' && <PanelRawTab data={r} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />}
          </>
        )}
      </div>
    </div>
  );
}
