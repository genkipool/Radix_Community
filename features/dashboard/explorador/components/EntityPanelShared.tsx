'use client';

/**
 * EntityPanelShared.tsx
 *
 * Shared sub-components used by inline entity detail panels:
 *   – ResourceInlinePanel  (inside BalanceChangeRow)
 *   – ValidatorInlinePanel
 *   – NftCollectionPanel   (inside NftTransferCard)
 *
 * Extracted to eliminate duplication of tab bars, role rows, section headers,
 * loading states, and the metadata / configuration / raw tab bodies.
 */

import React from 'react';
import { Check, Copy, Activity } from 'lucide-react';
import type { TranslationsT } from '@/features/dashboard/types';
import { Pill } from '@/components/ui/Pill';
import { parseTags, metaKeyLabel, getConfigEntries, resolutionTooltip } from '../../utils/resourceUtils';
import type { ConfigEntry, MetadataItem } from '@/features/dashboard/types/shared.types';
export type { ConfigEntry };
export { getConfigEntries, resolutionTooltip };

/* ─────────────────────────────────────────
   PanelSectionHeader
   Thin divider row with a label, used to
   group roles inside the configuration tab.
───────────────────────────────────────── */
export function PanelSectionHeader({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 pt-3 pb-1">
            <span className="text-[9px] uppercase tracking-widest font-black text-[var(--color-text-muted)] opacity-60">
                {label}
            </span>
            <div className="flex-1 h-px bg-[var(--color-card-border)]/50" />
        </div>
    );
}

/* ─────────────────────────────────────────
   PanelRoleRow
   Single role assignment display row.
───────────────────────────────────────── */
export function PanelRoleRow({
    entry, tt, onCopy, copiedAddress,
}: {
    entry: ConfigEntry;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
}) {
    const resolutionColor = (r: string) =>
        r === (tt.role_resolution_deny_all || 'Deny All')    ? 'text-[var(--color-text-muted)]'
        : r === (tt.role_resolution_allow_all || 'Allow All') ? 'text-green-400'
        : 'text-[var(--color-primary)]';

    return (
        <div className="flex items-start justify-between gap-4 py-2.5">
            <div className="flex-1 min-w-0">
                <dt
                    className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-main)] capitalize"
                    title={tt.role_tooltip_name || 'The name of this role and what it controls.'}
                >
                    {entry.name.replace(/_/g, ' ')}
                </dt>
                {entry.desc && (
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed pr-4">
                        {entry.desc}
                    </p>
                )}
                {entry.ruleAddress && (
                    <div className="flex items-center gap-1 mt-1">
                        <span
                            className="text-[9px] font-mono text-[var(--color-text-muted)] truncate max-w-[180px]"
                            title={entry.ruleAddress}
                        >
                            {entry.ruleAddress.slice(0, 16)}...{entry.ruleAddress.slice(-6)}
                        </span>
                        <button
                            onClick={e => { e.stopPropagation(); onCopy(entry.ruleAddress!); }}
                            className={`p-0.5 rounded transition-colors ${copiedAddress === entry.ruleAddress ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            {copiedAddress === entry.ruleAddress
                                ? <Check className="w-2.5 h-2.5" />
                                : <Copy  className="w-2.5 h-2.5" />}
                        </button>
                    </div>
                )}
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                <span
                    className={`text-xs font-bold ${resolutionColor(entry.resolution)}`}
                    title={resolutionTooltip(entry.resolution, tt)}
                >
                    {entry.resolution}
                </span>
                <span
                    className={`text-[9px] font-bold ${entry.updatable ? 'text-amber-400' : 'text-[var(--color-text-muted)]'}`}
                    title={entry.updatable
                        ? (tt.role_tooltip_status_updatable || 'The assignment of this role can be changed.')
                        : (tt.role_tooltip_status_immutable || 'The assignment of this role is permanently fixed.')}
                >
                    {entry.updatable
                        ? (tt.resource_panel_updatable || 'Updatable')
                        : (tt.resource_panel_immutable || 'Immutable')}
                </span>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────
   PanelTabBar
   The underline-style tab navigation used
   in all inline entity panels.
───────────────────────────────────────── */
export function PanelTabBar<T extends string>({
    tabs, activeTab, onTabChange,
}: {
    tabs: { key: T; label: string }[];
    activeTab: T;
    onTabChange: (tab: T) => void;
}) {
    return (
        <div className="flex border-b border-[var(--color-card-border)] px-4 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    type="button"
                    onClick={e => { e.stopPropagation(); onTabChange(tab.key); }}
                    className={`px-3 py-2.5 text-[10px] font-bold border-b-2 transition-all whitespace-nowrap tracking-wide ${
                        activeTab === tab.key
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

/* ─────────────────────────────────────────
   PanelLoadingState
───────────────────────────────────────── */
export function PanelLoadingState({ tt }: { tt: TranslationsT['dashboard']['transactions'] }) {
    return (
        <div className="flex items-center gap-2 py-3 text-[var(--color-text-muted)]">
            <Activity className="w-3.5 h-3.5 animate-spin text-[var(--color-primary)]" />
            <span className="text-xs">{tt.resource_panel_loading || 'Loading details...'}</span>
        </div>
    );
}

/* ─────────────────────────────────────────
   PanelMetadataTab
   Renders gateway metadata items as a list
   of key→value rows, with tags as Pills and
   URLs as anchor links.
───────────────────────────────────────── */
export function PanelMetadataTab({
    metadataItems, tt,
}: {
    metadataItems: MetadataItem[];
    tt: TranslationsT['dashboard']['transactions'];
}) {
    if (metadataItems.length === 0) {
        return (
            <p className="py-4 text-xs text-[var(--color-text-muted)]">
                {tt.resource_panel_no_metadata || 'No metadata found.'}
            </p>
        );
    }
    return (
        <div className="space-y-4">
            {metadataItems.map((meta: MetadataItem, idx: number) => {
                const tagValues = parseTags(meta);
                const isTags = meta.key === 'tags' || (meta.value as Record<string, Record<string, string>>)?.typed?.type === 'StringArray';
                const val = isTags ? '' : (
                    meta.value.typed?.value ??
                    meta.value.typed?.url ??
                    meta.value.programmatic_json?.value ??
                    meta.value.programmatic_json?.fields?.[0]?.value ??
                    String(meta.value.typed?.kind ?? '')
                );
                const isUrl = !isTags && typeof val === 'string' && (val.startsWith('http') || val.startsWith('ipfs'));
                return (
                    <div key={idx}>
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
                            {metaKeyLabel(meta.key as string, tt)}
                        </dt>
                        {isTags ? (
                            <dd className="flex flex-wrap gap-1.5">
                                {tagValues.map((tag: string, ti: number) => <Pill key={ti}>{tag}</Pill>)}
                            </dd>
                        ) : (
                            <dd className="text-xs text-[var(--color-text-main)] leading-relaxed break-words">
                                {isUrl
                                    ? <a href={val} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline" onClick={e => e.stopPropagation()}>{val}</a>
                                    : val}
                            </dd>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ─────────────────────────────────────────
   PanelConfigurationTab
   Renders role assignments grouped into
   admin / roles / metadata sections.
───────────────────────────────────────── */
export function PanelConfigurationTab({
    configEntries, tt, onCopy, copiedAddress,
}: {
    configEntries: ConfigEntry[];
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
}) {
    if (configEntries.length === 0) {
        return (
            <p className="py-4 text-xs text-[var(--color-text-muted)]">
                {tt.resource_panel_no_config || 'No configuration data.'}
            </p>
        );
    }
    const adminEntries    = configEntries.filter(e => e.group === 'admin');
    const roleEntries     = configEntries.filter(e => e.group === 'roles');
    const metaRoleEntries = configEntries.filter(e => e.group === 'metadata');
    const rowProps = { tt, onCopy, copiedAddress };
    return (
        <dl>
            {adminEntries.length > 0 && (
                <>
                    <PanelSectionHeader label={tt.role_section_admin || 'Role Administrator'} />
                    <div className="divide-y divide-[var(--color-card-border)]/30">
                        {adminEntries.map((e, i) => <PanelRoleRow key={i} entry={e} {...rowProps} />)}
                    </div>
                </>
            )}
            {roleEntries.length > 0 && (
                <>
                    <PanelSectionHeader label={tt.role_section_roles || 'Roles'} />
                    <div className="divide-y divide-[var(--color-card-border)]/30">
                        {roleEntries.map((e, i) => <PanelRoleRow key={i} entry={e} {...rowProps} />)}
                    </div>
                </>
            )}
            {metaRoleEntries.length > 0 && (
                <>
                    <PanelSectionHeader label={tt.role_section_metadata || 'Metadata Roles'} />
                    <div className="divide-y divide-[var(--color-card-border)]/30">
                        {metaRoleEntries.map((e, i) => <PanelRoleRow key={i} entry={e} {...rowProps} />)}
                    </div>
                </>
            )}
        </dl>
    );
}

/* ─────────────────────────────────────────
   PanelRawTab
   Renders a raw JSON blob in a scrollable
   code block.
───────────────────────────────────────── */
export function PanelRawTab({ data }: { data: unknown }) {
    return (
        <div className="w-full overflow-hidden">
            <pre className="p-3 bg-[#0d1117] rounded-xl border border-[var(--color-card-border)] text-[10px] font-mono text-green-400/90 overflow-x-auto overflow-y-auto max-h-56 custom-scrollbar whitespace-pre-wrap break-all">
                {JSON.stringify(data, null, 2)}
            </pre>
        </div>
    );
}
