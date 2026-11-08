'use client';
/**
 * The look of an entity drawn as a card in a list (ExpandableEntityBadge's
 * `resource-card` variant, e.g. a validator in an account's Staking tab):
 * the frame, the clickable header with name, short address and copy, and the
 * stake columns on the right. Only the look, so Babylon and Olympia entities
 * share it.
 */
import React from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { formatNumber } from '@/utils/formatters';

/** The frame of a resource card, ringed while open. */
export function resourceCardFrameClass(expanded: boolean): string {
    return `bg-[var(--color-surface)] border border-[var(--color-card-border)] transition-all duration-300 overflow-hidden ${expanded ? 'ring-2 ring-[var(--color-primary)] shadow-md' : 'shadow-md hover:shadow-lg'}`;
}

export interface StakeColumn {
    label: string;
    amount: number;
    /** Colour of the amount; defaults to the main text colour. */
    tone?: string;
    /** The unit after the amount, in the card size (e.g. XRD). */
    unit?: string;
}

/**
 * Stake columns (stake, unstake, claim…) on the right of an entity: label over
 * amount, separated by a thin rule. `compact` is the small size of an inline badge.
 */
export function StakeColumns({ columns, locale, compact = false }: { columns: StakeColumn[]; locale?: string; compact?: boolean }) {
    if (columns.length === 0) return null;
    return (
        <div className="flex items-center gap-4 mr-3">
            {columns.map((c, i) => (
                <div key={c.label} className={`flex flex-col items-end ${i > 0 ? `border-l ${compact ? 'border-white/10' : 'border-[var(--color-card-border)]'} pl-3` : ''}`}>
                    <span className={`${compact ? 'text-[8px] tracking-tighter' : 'text-[9px] tracking-wider'} text-[var(--color-text-muted)] uppercase font-black leading-none opacity-60`}>
                        {c.label}
                    </span>
                    <div className={`flex items-baseline gap-1 ${compact ? 'mt-0.5' : 'mt-1'}`}>
                        <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-mono font-black ${c.tone ?? 'text-[var(--color-text-main)]'} leading-none tracking-tight`}>
                            {formatNumber(c.amount, 2, locale)}
                        </span>
                        {!compact && c.unit && <span className="text-[9px] font-bold text-[var(--color-text-muted)]">{c.unit}</span>}
                    </div>
                </div>
            ))}
        </div>
    );
}

/** The clickable header of a resource card. */
export function ResourceCardHeader({
    address, shortAddress, name, nameColor, iconUrl, addressTitle, onToggle, onCopy, copiedAddress, right, actions, expanded, copyLabel,
}: {
    /** Tooltip of the copy button. */
    copyLabel?: string;
    address: string;
    shortAddress: string;
    name?: string | null;
    /** The entity kind's colour for the name. */
    nameColor: string;
    iconUrl?: string | null;
    addressTitle?: string;
    onToggle: (e: React.MouseEvent) => void;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    /** Between the name and the chevron (stake columns). */
    right?: React.ReactNode;
    /** Small buttons before the chevron. */
    actions?: React.ReactNode;
    expanded: boolean;
}) {
    const copied = copiedAddress === address;
    return (
        <div className="flex-1 flex items-center justify-between gap-3 p-3 min-h-[52px] cursor-pointer transition-colors group/entity" onClick={onToggle}>
            <div className="flex items-center gap-2 min-w-0">
                {iconUrl && (
                    <div className="size-8 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center border border-[var(--color-card-border)] shadow-sm">
                        <SafeImage src={iconUrl} alt={name || 'Token'} fallbackName={name || 'Token'} className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="min-w-0 flex-1 flex flex-col">
                    {name && (
                        <span className={`text-sm font-bold group-hover:text-[var(--color-secondary)] transition-colors truncate ${nameColor}`}>{name}</span>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className={`font-mono text-[10px] truncate ${name ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`} title={addressTitle || address}>
                            {shortAddress}
                        </span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                            className={`p-0.5 rounded transition-colors ${copied ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            title={copyLabel}
                        >
                            {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {right}
                {actions}
                <ChevronDown className={`size-4 text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
            </div>
        </div>
    );
}
