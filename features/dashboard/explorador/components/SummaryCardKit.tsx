'use client';

import React from 'react';
import { Check, Copy, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
 * Building blocks shared by the Summary-tab action cards (resource creation,
 * governance vote…). They only use theme tokens, so every card follows the
 * selected theme, and the card is a CSS container so its layout adapts to
 * the width it gets (single or two-column explorer, phone).
 */

export const shortenAddress = (addr: string) => (addr.length > 22 ? `${addr.slice(0, 12)}…${addr.slice(-6)}` : addr);

/** Card frame with the uppercase header used across the Summary tab. */
export function SummaryCard({ icon: Icon, title, aside, children }: {
    icon: LucideIcon;
    title: string;
    aside?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="@container bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                    <Icon className="size-3.5 text-[var(--color-primary)] shrink-0" />
                    <span className="truncate">{title}</span>
                </span>
                {aside && <span className="flex items-center gap-1.5 shrink-0 normal-case tracking-normal">{aside}</span>}
            </h3>
            {children}
        </section>
    );
}

/** Soft gradient band that holds the identity of what the card is about. */
export function SummaryHero({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative p-4 @md:p-5 bg-gradient-to-br from-[var(--color-primary)]/10 via-transparent to-[var(--color-secondary)]/10">
            {children}
        </div>
    );
}

export function SummaryBody({ children }: { children: React.ReactNode }) {
    return <div className="p-4 @md:p-5 space-y-4 border-t border-[var(--color-card-border)]">{children}</div>;
}

/** One plain-language sentence telling a newcomer what happened. */
export function PlainSummary({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-3 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3 @md:p-4">
            <Info className="size-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
            <p className="text-[13px] @md:text-sm leading-relaxed text-[var(--color-text-main)]">{children}</p>
        </div>
    );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h4 className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{children}</h4>;
}

/** Labelled tile for a facts grid. */
export function FactTile({ icon: Icon, label, children, hint }: { icon: LucideIcon; label: string; children: React.ReactNode; hint?: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                <Icon className="size-3 text-[var(--color-primary)] shrink-0" />
                <span className="truncate">{label}</span>
            </span>
            <div className="min-w-0 text-sm font-semibold text-[var(--color-text-main)]">{children}</div>
            {hint && <span className="text-[11px] leading-snug text-[var(--color-text-muted)]">{hint}</span>}
        </div>
    );
}

/** Responsive grid for FactTiles: 1, 2 or 4 columns depending on the card width. */
export function FactGrid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4 gap-3">{children}</div>;
}

export function CopyButton({ value, copiedAddress, onCopy, title }: { value: string; copiedAddress: string | null; onCopy: (v: string) => void; title: string }) {
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCopy(value); }}
            className="p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
            title={title}
            aria-label={title}
        >
            {copiedAddress === value ? <Check className="size-3.5 text-[var(--color-accent)]" /> : <Copy className="size-3.5" />}
        </button>
    );
}

/** Shortened address with a copy button. */
export function AddressChip({ address, copiedAddress, onCopy, copyTitle }: { address: string; copiedAddress: string | null; onCopy: (v: string) => void; copyTitle: string }) {
    return (
        <span className="flex items-center gap-1 min-w-0">
            <span className="font-mono text-xs truncate" title={address}>{shortenAddress(address)}</span>
            <CopyButton value={address} copiedAddress={copiedAddress} onCopy={onCopy} title={copyTitle} />
        </span>
    );
}
