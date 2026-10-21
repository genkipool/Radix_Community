'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, CalendarClock, Lock, Percent, TrendingDown, TrendingUp, Unlock, Info } from 'lucide-react';
import { StatCard } from './StatCard';
import { apiFetchNetworkUnstaking, type NetworkUnstakingData } from '../services/apiClient';
import { formatPercent, formatXRD } from '@/utils/formatters';
import type { Network, TranslationsT } from '../types';

interface NetworkInsightsPanelProps {
    network: Network;
    /** All the XRD staked, to put the pending figure in proportion. */
    totalStaked: number;
    /** False while the panel is folded: nothing is read or refreshed then. */
    open: boolean;
    dt?: Partial<TranslationsT['dashboard']>;
    locale: string;
}

const HOUR = 60 * 60 * 1000;

/**
 * The change in the still-locked figure over `hours`, from the hourly samples,
 * or null while there is not enough history to say (the oldest sample must reach
 * back at least 80% of the span, so a day-old figure is never called a week's).
 */
function changeOver(samples: NetworkUnstakingData['samples'], hours: number): { amount: number; percent: number | null } | null {
    const known = samples.filter((s): s is [number, number, number] => s[2] !== null);
    const latest = known.at(-1);
    if (!latest || known.length < 2) return null;
    const target = latest[0] - hours * HOUR;
    // The sample closest to the start of the span.
    const start = known.reduce((best, s) => (Math.abs(s[0] - target) < Math.abs(best[0] - target) ? s : best), known[0]);
    if (latest[0] - start[0] < hours * HOUR * 0.8) return null;
    const amount = latest[2] - start[2];
    return { amount, percent: start[2] > 0 ? (amount / start[2]) * 100 : null };
}

function Change({ value, locale }: { value: ReturnType<typeof changeOver>; locale: string }) {
    if (!value) return null;
    const Icon = value.amount >= 0 ? TrendingUp : TrendingDown;
    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon className="size-4 shrink-0" />
            {value.amount >= 0 ? '+' : '−'}{formatXRD(Math.abs(value.amount), locale)} XRD
            {value.percent !== null && ` (${value.amount >= 0 ? '+' : '−'}${formatPercent(Math.abs(value.percent), 1, locale)})`}
        </span>
    );
}

/**
 * How much XRD the network has waiting to be withdrawn from staking, and
 * whether it is growing. Mounted only once opened, and it stops polling while
 * folded, so a visitor who never opens it costs nothing.
 */
export function NetworkInsightsPanel({ network, totalStaked, open, dt, locale }: NetworkInsightsPanelProps) {
    const t = dt?.insights;
    const { data, isLoading, isError } = useQuery({
        queryKey: ['network-unstaking', network],
        queryFn: () => apiFetchNetworkUnstaking(network),
        enabled: open,
        staleTime: 60_000,
        // The server refreshes at most every 15 minutes; a look every minute while open is plenty.
        refetchInterval: open ? 60_000 : false,
    });

    const hasFigure = !!data?.updatedAt;
    const change24 = data ? changeOver(data.samples, 24) : null;
    const change7d = data ? changeOver(data.samples, 24 * 7) : null;
    const waiting = !hasFigure && (isLoading || !isError);
    const unbonding = data?.unbonding ?? null;
    const unclaimed = hasFigure && unbonding !== null ? Math.max(0, data.pending - unbonding) : null;

    const noHistory = t?.no_history ?? 'Collecting history';
    const xrd = (n: number) => `${formatXRD(n, locale)} XRD`;

    return (
        <section aria-label={t?.title} className="mb-6 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 sm:p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-[var(--color-text-main)] mb-4">{t?.title ?? 'Network staking flow'}</h2>

            {isError && !hasFigure ? (
                <p className="text-sm text-[var(--color-text-muted)]">{t?.unavailable ?? 'The figure is not available right now.'}</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <StatCard
                        icon={<Lock className="size-5" />}
                        label={t?.unbonding ?? 'Unlocking now (≈)'}
                        value={unbonding !== null ? `≈ ${xrd(unbonding)}` : '---'}
                        accent
                        description={t?.unbonding_desc}
                        fullValue={unbonding !== null ? `${Math.round(unbonding).toLocaleString(locale)} XRD` : undefined}
                        isLoading={waiting}
                    />
                    <StatCard
                        icon={<Percent className="size-5" />}
                        label={t?.share ?? 'Share of total stake'}
                        value={unbonding !== null && totalStaked > 0 ? formatPercent((unbonding / totalStaked) * 100, 2, locale) : '---'}
                        description={t?.share_desc}
                        isLoading={waiting}
                    />
                    <StatCard
                        icon={<TrendingUp className="size-5" />}
                        label={t?.change_24h ?? 'Change in 24 h'}
                        value={change24 ? <Change value={change24} locale={locale} /> : hasFigure ? noHistory : '---'}
                        description={t?.change_desc}
                        isLoading={waiting}
                    />
                    <StatCard
                        icon={<TrendingUp className="size-5" />}
                        label={t?.change_7d ?? 'Change in 7 days'}
                        value={change7d ? <Change value={change7d} locale={locale} /> : hasFigure ? noHistory : '---'}
                        description={t?.change_desc}
                        isLoading={waiting}
                    />
                    <StatCard
                        icon={<Unlock className="size-5" />}
                        label={t?.unclaimed ?? 'Unlocked, not claimed (≈)'}
                        value={unclaimed !== null ? `≈ ${xrd(unclaimed)}` : '---'}
                        description={t?.unclaimed_desc}
                        isLoading={waiting}
                    />
                    <StatCard
                        icon={<ArrowDownToLine className="size-5" />}
                        label={t?.pending ?? 'In the withdraw vaults'}
                        value={hasFigure ? xrd(data.pending) : '---'}
                        description={t?.pending_desc}
                        fullValue={hasFigure ? `${data.pending.toLocaleString(locale)} XRD` : undefined}
                        isLoading={waiting}
                    />
                    <StatCard
                        icon={<CalendarClock className="size-5" />}
                        label={t?.delay ?? 'Unlock period'}
                        value={t?.delay_value ?? '7 days'}
                        description={t?.delay_desc}
                    />
                </div>
            )}

            <p className="mt-4 flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                <Info className="size-4 shrink-0 mt-px" />
                <span>{t?.note}</span>
            </p>
            {hasFigure && (
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                    {t?.updated ?? 'Updated'} {new Date(data.updatedAt!).toLocaleString(locale)} · {data.validators} {t?.validators ?? 'validators counted'}
                </p>
            )}
        </section>
    );
}
