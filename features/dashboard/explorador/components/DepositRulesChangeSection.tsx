'use client';

import { BadgeCheck, ShieldCheck } from 'lucide-react';

import { SafeImage } from '@/components/ui/SafeImage';
import { extractEntityMeta } from '@/features/dashboard/hooks/useEntityData';
import type { GatewayEntityDetails, GatewayEvent, Network, TranslationsT } from '@/features/dashboard/types';
import { useEntityDetailsBatch } from '../hooks/useEntityDetailsBatch';
import { depositRuleResources, extractDepositRuleChanges, type DepositRuleChange } from '../utils/depositRuleEvents';
import { RULE_ICON } from './AccountDepositsTab';
import { AddressChip } from './SummaryCardKit';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

/** A resource as a person reads it: icon, symbol or name, and the address to copy. */
export function ResourceLine({ address, details, localId, copiedAddress, onCopy, copyTitle }: {
    address: string;
    details: GatewayEntityDetails | undefined;
    localId?: string | null;
    copiedAddress: string | null;
    onCopy: (v: string) => void;
    copyTitle: string;
}) {
    const meta = details ? extractEntityMeta(details) : null;
    const label = meta?.symbol || meta?.name || '…';
    return (
        <span className="flex items-center gap-2 min-w-0">
            {meta?.iconUrl ? (
                <SafeImage src={meta.iconUrl} alt={label} fallbackName={label} className="size-6 rounded-full object-cover shrink-0" />
            ) : (
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--color-primary)]/10 text-[8px] font-black text-[var(--color-primary)]">
                    {label.slice(0, 2).toUpperCase()}
                </span>
            )}
            <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-[var(--color-text-main)]" title={meta?.name ?? undefined}>
                    {label}{localId && <span className="ml-1 font-mono font-normal text-[var(--color-text-muted)]">{localId}</span>}
                </span>
                <AddressChip address={address} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
            </span>
        </span>
    );
}

/**
 * What a transaction changed in accounts' deposit rules: the general rule,
 * per-resource exceptions set or removed, and authorised depositor badges
 * added or removed, in the words of the account's Deposits tab. Read from the
 * events native accounts emit; the resources' names come in one request.
 */
export function DepositRulesChangeSection({ events, tt, onCopy, copiedAddress, network }: {
    events: GatewayEvent[];
    tt?: Tt;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: Network;
}) {
    const changes = extractDepositRuleChanges(events);
    const { data: entities } = useEntityDetailsBatch(depositRuleResources(changes), network);
    const accounts = Object.keys(changes);
    if (accounts.length === 0) return null;

    const d = tt?.account_summary?.deposits;
    const copyTitle = d?.copy ?? 'Copy';
    const kindLabel = 'text-[9px] uppercase font-black tracking-wider text-[var(--color-text-muted)]';

    const row = (change: DepositRuleChange, i: number) => {
        if (change.kind === 'default') {
            const Icon = RULE_ICON[change.rule];
            const rule = d?.rules?.[change.rule];
            return (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <span className={kindLabel}>{tt?.deposit_change_default || 'General rule'}</span>
                    <span className="flex items-center gap-2 min-w-0 text-right">
                        <span className="min-w-0">
                            <span className="block text-xs font-bold text-[var(--color-text-main)]">{rule?.label ?? change.rule}</span>
                            {rule?.hint && <span className="block text-[11px] text-[var(--color-text-muted)]">{rule.hint}</span>}
                        </span>
                        <Icon className="size-4 shrink-0 text-[var(--color-primary)]" />
                    </span>
                </li>
            );
        }

        const resource = (
            <ResourceLine
                address={change.resource}
                details={entities?.[change.resource]}
                localId={'localId' in change ? change.localId : null}
                copiedAddress={copiedAddress}
                onCopy={onCopy}
                copyTitle={copyTitle}
            />
        );
        const [label, outcome, color, title] =
            change.kind === 'preference'
                ? change.preference === 'Allowed'
                    ? [tt?.deposit_change_exception || 'Exception', d?.allowed || 'Allowed', 'text-[var(--color-success)]', d?.allowed_title]
                    : [tt?.deposit_change_exception || 'Exception', d?.refused || 'Blocked', 'text-[var(--color-danger)]', d?.refused_title]
                : change.kind === 'preference_removed'
                    ? [tt?.deposit_change_exception || 'Exception', tt?.deposit_change_exception_removed || 'Removed: follows the general rule', 'text-[var(--color-text-muted)]', undefined]
                    : change.kind === 'depositor_added'
                        ? [d?.depositors || 'Authorised depositors', tt?.deposit_change_depositor_added || 'Added', 'text-[var(--color-success)]', d?.depositors_hint]
                        : [d?.depositors || 'Authorised depositors', tt?.deposit_change_depositor_removed || 'Removed', 'text-[var(--color-danger)]', undefined];
        return (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[10rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5">
                <span className={`hidden sm:block ${kindLabel}`}>{label}</span>
                {resource}
                <span className={`text-right text-xs font-bold ${color}`} title={title}>{outcome}</span>
            </li>
        );
    };

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-primary)]/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-primary)]/20 bg-[var(--color-surface)] flex items-center gap-2">
                <ShieldCheck className="size-3.5 text-[var(--color-primary)]" />
                {tt?.deposit_changes_label || 'Deposit rules changed'}
            </h3>
            <div className="p-3 space-y-4">
                {accounts.map((account) => (
                    <div key={account}>
                        <div className="flex items-center gap-2 px-1 pb-1 text-[11px] text-[var(--color-text-muted)]">
                            <BadgeCheck className="size-3.5 text-[var(--color-primary)]" />
                            <AddressChip address={account} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                        </div>
                        <ul className="divide-y divide-[var(--color-card-border)] px-1">{changes[account].map(row)}</ul>
                    </div>
                ))}
                {d?.note && <p className="px-1 text-[10px] italic text-[var(--color-text-muted)]">{d.note}</p>}
            </div>
        </div>
    );
}
