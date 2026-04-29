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
import { motion } from 'motion/react';
import { Check, Copy, Activity } from 'lucide-react';
import type { TranslationsT } from '@/features/dashboard/types';
import { Pill } from '@/components/ui/Pill';
import { parseTags, metaKeyLabel, getConfigEntries, resolutionTooltip, parseProgrammaticJson } from '../../utils/resourceUtils';
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
        : r === (tt.role_resolution_allow_all || 'Allow All') ? 'text-green-700 dark:text-green-400'
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
                            className="text-[9px] font-mono text-[var(--color-text-muted)] break-all"
                            title={entry.ruleAddress}
                        >
                            {entry.ruleAddress}
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
    tabs: { key: T; label: string; tooltip?: string }[];
    activeTab: T;
    onTabChange: (tab: T) => void;
}) {
    return (
        <div className="flex border-b border-[var(--color-card-border)] px-4 overflow-x-auto hide-scrollbar">
            {tabs.map(tab => (
                <motion.button
                    key={tab.key}
                    type="button"
                    whileHover="hover"
                    onClick={e => { e.stopPropagation(); onTabChange(tab.key); }}
                    title={tab.tooltip}
                    className={`px-4 py-2.5 text-[10px] font-bold transition-all relative whitespace-nowrap tracking-wide ${
                        activeTab === tab.key
                            ? 'text-[var(--color-primary)]'
                            : 'text-[var(--color-text-muted)]'
                    }`}
                >
                    <span className="relative z-10 transition-colors group-hover:text-[var(--color-text-main)]">
                        {tab.label}
                    </span>
                    
                    {/* Hover Background */}
                    <motion.div
                        className="absolute inset-x-1 inset-y-1.5 rounded-lg bg-white/5 -z-0"
                        variants={{
                            hover: { opacity: 1, scale: 1 },
                            initial: { opacity: 0, scale: 0.95 }
                        }}
                        initial="initial"
                        transition={{ duration: 0.2 }}
                    />

                    {activeTab === tab.key && (
                        <motion.div 
                            layoutId="activeTabUnderline"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]"
                            initial={false}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    )}
                </motion.button>
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
                
                const rawVal = isTags ? null : (
                    meta.value.typed?.values ??
                    meta.value.typed?.value ??
                    meta.value.typed?.url ??
                    (meta.value.programmatic_json ? parseProgrammaticJson(meta.value.programmatic_json) : undefined) ??
                    meta.value.typed?.kind
                );

                let valueItems: string[] = [];
                if (Array.isArray(rawVal)) {
                    valueItems = rawVal.map(v => String(v));
                } else if (typeof rawVal === 'string') {
                    if (rawVal.includes(',')) {
                        const splitted = rawVal.split(',');
                        const isAddressList = splitted.every(s => {
                            const t = s.trim();
                            return t.startsWith('account_') ||
                                   t.startsWith('resource_') ||
                                   t.startsWith('component_') ||
                                   t.startsWith('pool_') ||
                                   t.startsWith('package_') ||
                                   t.startsWith('validator_');
                        });
                        if (isAddressList) {
                            valueItems = splitted.map(s => s.trim()).filter(Boolean);
                        } else {
                            valueItems = [rawVal];
                        }
                    } else {
                        valueItems = [rawVal];
                    }
                } else if (rawVal !== null && rawVal !== undefined) {
                    valueItems = [String(rawVal)];
                }

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
                            <dd className="text-xs text-[var(--color-text-main)] leading-relaxed break-words space-y-1">
                                {valueItems.map((vItem, vi) => {
                                    const isUrl = typeof vItem === 'string' && (vItem.startsWith('http') || vItem.startsWith('ipfs'));
                                    return (
                                        <div key={vi}>
                                            {isUrl && typeof vItem === 'string' ? (
                                                <a href={vItem} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline" onClick={e => e.stopPropagation()}>{vItem}</a>
                                            ) : (
                                                vItem
                                            )}
                                        </div>
                                    );
                                })}
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
    const adminEntries       = configEntries.filter(e => e.group === 'admin');
    const mainRoleEntries    = configEntries.filter(e => e.group === 'main');
    const royaltyRoleEntries = configEntries.filter(e => e.group === 'royalty');
    const roleEntries        = configEntries.filter(e => e.group === 'roles');
    const metaRoleEntries    = configEntries.filter(e => e.group === 'metadata');
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
            {mainRoleEntries.length > 0 && (
                <>
                    <PanelSectionHeader label={tt.role_section_main || 'Main Roles'} />
                    <div className="divide-y divide-[var(--color-card-border)]/30">
                        {mainRoleEntries.map((e, i) => <PanelRoleRow key={i} entry={e} {...rowProps} />)}
                    </div>
                </>
            )}
            {royaltyRoleEntries.length > 0 && (
                <>
                    <PanelSectionHeader label={tt.role_section_royalty || 'Royalty Roles'} />
                    <div className="divide-y divide-[var(--color-card-border)]/30">
                        {royaltyRoleEntries.map((e, i) => <PanelRoleRow key={i} entry={e} {...rowProps} />)}
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
export function PanelRawTab({
    data, tt, onCopy, copiedAddress,
}: {
    data: unknown;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
}) {
    const rawJson = JSON.stringify(data, null, 2);
    return (
        <div className="w-full overflow-hidden relative group">
            <motion.button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCopy(rawJson); }}
                className={`absolute top-3 right-3 transition-colors flex items-center z-10 ${
                    copiedAddress === rawJson
                        ? 'text-green-500'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                }`}
                title={copiedAddress === rawJson ? tt.copied_json || 'JSON Copied!' : tt.copy_json || 'Copy JSON'}
            >
                {copiedAddress === rawJson ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </motion.button>
            <pre className="p-3 bg-[#0d1117] rounded-xl border border-[var(--color-card-border)] text-[10px] font-mono text-green-400/90 overflow-x-auto overflow-y-auto max-h-56 custom-scrollbar whitespace-pre-wrap break-all">
                {rawJson}
            </pre>
        </div>
    );
}
