'use client';

import React from 'react';
import { Zap, Activity } from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import { Pill } from '@/components/ui/Pill';
import { ExpandableEntityBadge } from '@/features/dashboard/explorador/components/ExpandableEntityBadge';

import { EntitiesSectionProps } from '../types';

/**
 * EntitiesSection
 *
 * Replaces the previously duplicated CreatedEntitiesSection and
 * AffectedEntitiesSection. Switch behaviour via the `variant` prop.
 * Entity badges are expandable — clicking shows detail tabs.
 */
export function EntitiesSection({
    variant, details, tt, onCopy, copiedAddress, onResourceClick, network, locale, marketData,
}: EntitiesSectionProps) {
    const isCreated = variant === 'created';

    /* ── Resolve addresses ─────────────────────────────────── */
    const entities: string[] = isCreated
        ? (details.receipt?.state_updates?.new_global_entities ?? [])
            .map((e) => sanitizeText(e?.entity_address || ''))
            .filter(Boolean)
        : (details.affected_global_entities ?? [])
            .map((e: string | { address: string }) =>
                sanitizeText(typeof e === 'string' ? e : e?.address || '')
            )
            .filter(Boolean);

    /* ── Theme tokens ──────────────────────────────────────── */
    const icon = isCreated
        ? <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        : <Activity className="w-3.5 h-3.5 text-violet-400" />;
    const countColor = isCreated ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
        : 'bg-violet-500/10 text-violet-400 border-violet-500/20';
    const heading = isCreated
        ? (tt?.created_entities || 'Created Entities')
        : (tt?.affected_entities || 'Affected Entities');
    const emptyMsg = isCreated
        ? (tt?.no_created_entities || 'No new entities were created.')
        : (tt?.no_affected_entities || 'No affected entities found.');

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center justify-between">
                <span className="flex items-center gap-2">
                    {icon}
                    {String(heading)}
                </span>
                <Pill color="custom" className={countColor}>
                    {entities.length}
                </Pill>
            </h3>
            <div className="p-3">
                {entities.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                        {entities.map((addr, i) => (
                            <ExpandableEntityBadge
                                key={variant + i}
                                address={addr}
                                tt={tt}
                                onCopy={onCopy}
                                copiedAddress={copiedAddress}
                                onResourceClick={onResourceClick}
                                network={network}
                                locale={locale}
                                marketData={marketData}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--color-text-muted)] italic py-2 text-center">
                        {String(emptyMsg)}
                    </p>
                )}
            </div>
        </div>
    );
}
