'use client';

import React from 'react';
import {
    ThumbsUp, ThumbsDown, CircleDot, CheckCircle2, Circle, XCircle, AlertTriangle, BadgeCheck,
    CalendarClock, ArrowUpRight, ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationsT } from '@/features/dashboard/types';
import type { BallotChoice, GovernanceItem, TallySummary, VoteOutcome, VoteTone, VotingPhase } from '../utils/governanceVoteUtils';
import { SectionLabel } from './SummaryCardKit';

export type Gv = Partial<NonNullable<TranslationsT['dashboard']['transactions']['governance_vote']>>;

/* ── Shared styling and formatting ─────────────────────────── */

/** Theme tokens for each tone; red marks a vote against, as elsewhere in the explorer. */
export const TONE: Record<VoteTone, { text: string; soft: string; bar: string; icon: LucideIcon }> = {
    positive: { text: 'text-[var(--color-accent)]', soft: 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10', bar: 'bg-[var(--color-accent)]', icon: ThumbsUp },
    negative: { text: 'text-red-500', soft: 'border-red-500/35 bg-red-500/10', bar: 'bg-red-500', icon: ThumbsDown },
    neutral: { text: 'text-[var(--color-text-secondary)]', soft: 'border-[var(--color-card-border)] bg-[var(--color-surface)]', bar: 'bg-[var(--color-text-muted)]', icon: CircleDot },
};

export const fill = (tpl: string, values: Record<string, string>) =>
    Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), tpl);

export const formatXrd = (n: number, locale?: string) =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

export const formatPct = (n: number, locale?: string) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(n);

export function formatDate(sec: number, locale?: string, timeZone?: string) {
    const opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
    try {
        return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(sec * 1000);
    } catch {
        return new Intl.DateTimeFormat(locale, opts).format(sec * 1000);
    }
}

export function formatRelative(sec: number, locale?: string) {
    const diff = sec - Date.now() / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs >= 86_400) return rtf.format(Math.round(diff / 86_400), 'day');
    if (abs >= 3_600) return rtf.format(Math.round(diff / 3_600), 'hour');
    return rtf.format(Math.round(diff / 60), 'minute');
}

function Bar({ ratio, className }: { ratio: number; className: string }) {
    const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10;
    return (
        <div className="h-2 rounded-full bg-[var(--color-card-border)] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className={`h-full rounded-full transition-[width] duration-500 ${className}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

/* ── Verdict ───────────────────────────────────────────────── */

const OUTCOME_STYLE: Record<VoteOutcome, { icon: LucideIcon; box: string; text: string }> = {
    approved: { icon: BadgeCheck, box: 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10', text: 'text-[var(--color-accent)]' },
    rejected: { icon: XCircle, box: 'border-red-500/35 bg-red-500/10', text: 'text-red-500' },
    no_quorum: { icon: AlertTriangle, box: 'border-amber-500/35 bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
};

/** Final (or provisional, while voting is open) result, explained in one line. */
export function OutcomeBanner({ outcome, tally, item, final, gv, locale }: {
    outcome: VoteOutcome;
    tally: TallySummary;
    item: GovernanceItem | null;
    final: boolean;
    gv: Gv;
    locale?: string;
}) {
    const style = OUTCOME_STYLE[outcome];
    const Icon = style.icon;
    const values = {
        turnout: formatXrd(tally.turnout, locale),
        quorum: item?.quorum ? formatXrd(item.quorum, locale) : '—',
        share: tally.approvalShare !== null ? formatPct(tally.approvalShare, locale) : '—',
        threshold: item?.approvalThreshold != null ? formatPct(item.approvalThreshold, locale) : '—',
    };
    const headline = final
        ? { approved: gv.outcome_approved || 'Approved', rejected: gv.outcome_rejected || 'Rejected', no_quorum: gv.outcome_no_quorum || 'Quorum not reached' }[outcome]
        : { approved: gv.outcome_open_approved || 'Passing so far', rejected: gv.outcome_open_rejected || 'Failing so far', no_quorum: gv.outcome_open_no_quorum || 'Quorum not reached yet' }[outcome];
    const detail = final
        ? {
            approved: gv.outcome_approved_detail || '{turnout} XRD of voting power took part (the minimum was {quorum}) and {share} voted in favour, where {threshold} was needed.',
            rejected: gv.outcome_rejected_detail || 'There was quorum ({turnout} of {quorum} XRD), but only {share} voted in favour and {threshold} was needed.',
            no_quorum: gv.outcome_no_quorum_detail || 'Only {turnout} XRD of voting power took part and {quorum} were needed for the result to count.',
        }[outcome]
        : {
            approved: gv.outcome_open_approved_detail || 'So far {turnout} XRD of voting power is taking part (the minimum is {quorum}) and {share} is in favour; {threshold} is needed.',
            rejected: gv.outcome_open_rejected_detail || 'There is quorum so far ({turnout} of {quorum} XRD), but only {share} is in favour and {threshold} is needed.',
            no_quorum: gv.outcome_open_no_quorum_detail || 'So far {turnout} XRD of voting power is taking part and {quorum} is needed for the result to count.',
        }[outcome];

    return (
        <div className={`flex gap-3 rounded-xl border p-3 @md:p-4 ${style.box}`}>
            <span className={`grid place-items-center size-10 rounded-xl bg-[var(--color-card-bg)] shrink-0 ${style.text}`}>
                <Icon className="size-5" />
            </span>
            <div className="min-w-0">
                <p className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                    {final ? (gv.outcome_label || 'Result') : (gv.outcome_open_label || 'If it closed now')}
                </p>
                <p className={`text-lg font-black leading-tight ${style.text}`}>{headline}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{fill(detail, values)}</p>
            </div>
        </div>
    );
}

/* ── Ballot ────────────────────────────────────────────────── */

/** Ballot options; with a tally, each one shows the voting power behind it. */
export function BallotResults({ choices, tally, gv, locale }: { choices: BallotChoice[]; tally: TallySummary | null; gv: Gv; locale?: string }) {
    const rows = tally?.rows ?? choices.map(c => ({ ...c, power: 0, share: 0 }));
    return (
        <div>
            <SectionLabel>{tally ? (gv.results || 'Results') : (gv.options || 'Ballot options')}</SectionLabel>
            <ul className={`grid grid-cols-1 gap-2 ${tally ? '' : '@md:grid-cols-2 @3xl:grid-cols-3'}`}>
                {rows.map(r => (
                    <li
                        key={r.key}
                        className={`rounded-lg border px-3 py-2.5 ${r.selected ? TONE[r.tone].soft : 'border-[var(--color-card-border)] bg-[var(--color-card-bg)]'}`}
                    >
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                            <span className={`flex items-center gap-2 min-w-0 ${r.selected ? `${TONE[r.tone].text} font-bold` : 'text-[var(--color-text-main)]'}`}>
                                {r.selected ? <CheckCircle2 className="size-4 shrink-0" /> : <Circle className="size-4 shrink-0 opacity-40" />}
                                <span className="break-words">{r.label}</span>
                                {r.selected && (
                                    <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-current/30 shrink-0">
                                        {gv.selected || 'This vote'}
                                    </span>
                                )}
                            </span>
                            {tally && (
                                <span className="flex items-baseline gap-2 shrink-0 font-mono">
                                    <span className="text-xs text-[var(--color-text-muted)]">{formatXrd(r.power, locale)} XRD</span>
                                    <span className="text-sm font-black text-[var(--color-text-main)] w-14 text-right">{formatPct(r.share, locale)}</span>
                                </span>
                            )}
                        </div>
                        {tally && <div className="mt-2"><Bar ratio={r.share} className={TONE[r.tone].bar} /></div>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ── Turnout vs quorum ─────────────────────────────────────── */

export function TurnoutMeter({ tally, item, gv, locale }: { tally: TallySummary; item: GovernanceItem | null; gv: Gv; locale?: string }) {
    if (!item?.quorum || tally.quorumRatio === null) return null;
    const met = tally.quorumMet;
    const missing = Math.max(0, item.quorum - tally.turnout);
    return (
        <div>
            <SectionLabel>{gv.turnout || 'Turnout'}</SectionLabel>
            <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 @md:p-4 space-y-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-[var(--color-text-main)]">
                        <span className="text-xl font-black font-mono">{formatXrd(tally.turnout, locale)}</span>
                        <span className="text-[var(--color-text-muted)]"> / {formatXrd(item.quorum, locale)} XRD</span>
                    </span>
                    <span className={`flex items-center gap-1.5 text-xs font-bold ${met ? 'text-[var(--color-accent)]' : 'text-amber-600 dark:text-amber-400'}`}>
                        {met ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                        {met
                            ? fill(gv.quorum_met || 'Quorum reached ({pct} of the minimum)', { pct: formatPct(tally.quorumRatio, locale) })
                            : fill(gv.quorum_missing || '{missing} XRD short of the quorum', { missing: formatXrd(missing, locale) })}
                    </span>
                </div>
                <Bar ratio={tally.quorumRatio} className={met ? 'bg-[var(--color-accent)]' : 'bg-amber-500'} />
                <p className="text-[11px] leading-snug text-[var(--color-text-muted)]">
                    {gv.turnout_hint || 'Voting power is the XRD (liquid or staked) held by the accounts that voted. The quorum is the minimum that has to take part for the result to count.'}
                </p>
            </div>
        </div>
    );
}

/* ── Voting window ─────────────────────────────────────────── */

export function VotingWindow({ item, phase, progress, gv, locale, timezone }: {
    item: GovernanceItem;
    phase: VotingPhase;
    progress: number | null;
    gv: Gv;
    locale?: string;
    timezone?: string;
}) {
    if (!item.start || !item.deadline) return null;
    const phaseText = phase === 'open' ? fill(gv.ends_rel || 'Closes {time}', { time: formatRelative(item.deadline, locale) })
        : phase === 'upcoming' ? fill(gv.starts_rel || 'Starts {time}', { time: formatRelative(item.start, locale) })
            : fill(gv.closed_rel || 'Closed {time}', { time: formatRelative(item.deadline, locale) });
    return (
        <div>
            <SectionLabel>{gv.period || 'Voting period'}</SectionLabel>
            <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 @md:p-4 space-y-3">
                <div className="flex flex-col @md:flex-row @md:items-end justify-between gap-2 text-xs">
                    <span className="flex flex-col">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{gv.starts || 'Opens'}</span>
                        <span className="font-semibold text-[var(--color-text-main)]">{formatDate(item.start, locale, timezone)}</span>
                    </span>
                    <span className="flex flex-col @md:items-end">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{gv.ends || 'Closes'}</span>
                        <span className="font-semibold text-[var(--color-text-main)]">{formatDate(item.deadline, locale, timezone)}</span>
                    </span>
                </div>
                <Bar ratio={progress ?? 0} className={phase === 'closed' ? 'bg-[var(--color-text-muted)]' : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]'} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                        <CalendarClock className="size-3.5 text-[var(--color-primary)]" />{phaseText}
                    </p>
                    {item.elevatedProposalId && (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                            <ArrowUpRight className="size-3.5" />
                            {fill(gv.elevated || 'Moved on to formal proposal #{id}', { id: item.elevatedProposalId })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Links ─────────────────────────────────────────────────── */

export function LinkList({ links, title }: { links: string[]; title: string }) {
    if (links.length === 0) return null;
    return (
        <div>
            <SectionLabel>{title}</SectionLabel>
            <div className="flex flex-wrap gap-2">
                {links.map(link => {
                    let label = link;
                    try { const u = new URL(link); label = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname : ''); } catch { /* keep raw */ }
                    return (
                        <a
                            key={link}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="max-w-full flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors"
                            title={link}
                        >
                            <ExternalLink className="size-3 shrink-0" />
                            <span className="truncate">{label}</span>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}
