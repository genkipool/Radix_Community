'use client';
import React from 'react';
import { Coins } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import type { AccountCardProps } from '../types/components.types';
import { EntityCardFrame } from '../components/EntityCardFrame';
import { PanelConfigurationTab, PanelMetadataTab, PanelRawTab } from '../components/EntityPanelShared';
import { useOlympiaResource } from '@/features/dashboard/services/olympiaApi';
import { olympiaDict } from './dict';
import { formatDecimal } from './format';
import { OlympiaBadge, SourceNote } from './OlympiaParts';
import { olympiaResourceConfig, olympiaResourceMetadata, OlympiaResourceHolders, OlympiaResourceSummary } from './OlympiaResourcePanel';

/** The card of an Olympia token (`<symbol>_rr1…`). */
export function OlympiaResourceCard({ address, isExpanded, onExpand, onCopy, copiedAddress, t, locale, isModal, headless }: AccountCardProps) {
  const o = olympiaDict(t?.dashboard?.transactions);
  const { data: r } = useOlympiaResource(address);
  if (!r) return null;
  return (
    <EntityCardFrame
      address={address}
      avatar={r.iconUrl ? <SafeImage src={r.iconUrl} alt={r.symbol} fallbackName={r.symbol} className="size-8 object-cover rounded-xl" /> : <Coins className="size-8" style={{ color: 'var(--color-accent)' }} />}
      badge={<OlympiaBadge o={o} />}
      facts={[
        { label: o.resource_symbol, value: r.symbol, tone: 'secondary' },
        { label: o.resource_name, value: r.name ?? '—' },
        { label: o.total_supply, value: formatDecimal(r.totalSupply, locale, 2), tone: 'accent', title: r.totalSupply },
        { label: o.holders, value: r.holders.toLocaleString(locale) },
        { label: o.mutable, value: r.isMutable === null ? '—' : r.isMutable ? o.mutable_yes : o.mutable_no },
      ]}
      isExpanded={isExpanded}
      onExpand={onExpand}
      onCopy={onCopy}
      copiedAddress={copiedAddress}
      isModal={isModal}
      closeLabel={t?.dashboard?.reading?.close}
      headless={headless}
      tabs={[
        { key: 'summary', label: o.summary_tab, render: () => <div className="space-y-4"><OlympiaResourceSummary r={r} tt={t?.dashboard?.transactions} o={o} locale={locale} onCopy={onCopy} copiedAddress={copiedAddress} /><SourceNote o={o} /></div> },
        { key: 'metadata', label: t?.dashboard?.transactions?.resource_panel_metadata ?? '', render: () => <PanelMetadataTab metadataItems={olympiaResourceMetadata(r)} tt={t?.dashboard?.transactions} onCopy={onCopy} copiedAddress={copiedAddress} /> },
        { key: 'configuration', label: t?.dashboard?.transactions?.resource_panel_configuration ?? '', render: () => <PanelConfigurationTab configEntries={olympiaResourceConfig(r, t?.dashboard?.transactions)} tt={t?.dashboard?.transactions} onCopy={onCopy} copiedAddress={copiedAddress} /> },
        { key: 'holders', label: o.holders_tab, render: () => <OlympiaResourceHolders r={r} locale={locale} /> },
        { key: 'raw', label: o.raw_tab, tooltip: o.raw_tooltip, render: () => <PanelRawTab data={r} tt={t?.dashboard?.transactions} onCopy={onCopy} copiedAddress={copiedAddress} /> },
      ]}
    />
  );
}
