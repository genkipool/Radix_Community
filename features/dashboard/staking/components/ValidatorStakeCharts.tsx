'use client';
import React from 'react';
import { useMounted } from '@/hooks/useMounted';
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    AreaChart,
    Area,
} from 'recharts';
import { formatShortXRD } from '@/utils/formatters';
import {
    type StakeTooltipProps,
    type StakeEvolutionChartProps,
    type StakeHistoryChartProps
} from '../types/components.types';

/* ─────────────────────────────────────────
   Shared tooltip
───────────────────────────────────────── */
const StakeTooltip = ({ active, payload, label, t, locale }: StakeTooltipProps) => {
    if (!active || !payload?.length) return null;
    const stakeVal = (payload?.find((p) => p.dataKey === 'stake')?.value as number) ?? 0;
    const unstakeRaw = (payload?.find((p) => p.dataKey === 'unstakeNeg')?.value as number) ?? 0;
    const claimRaw = (payload?.find((p) => p.dataKey === 'claimNeg')?.value as number) ?? 0;
    const evolutionVal = payload?.find((p) => p.dataKey === 'totalStake')?.value as number | undefined;

    const unstakeVal = Math.abs(unstakeRaw);
    const claimVal = Math.abs(claimRaw);

    if (!stakeVal && !unstakeVal && !claimVal && evolutionVal === undefined) return null;

    return (
        <div className="veb-shc-tooltip">
            <span className="veb-shc-tt-date">
                {new Date(label || '').toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
            </span>
            {evolutionVal !== undefined && (
                <div className="veb-shc-tt-row">
                    <span className="veb-shc-tt-dot" style={{ background: 'var(--color-primary)' }} />
                    <span className="veb-shc-tt-k">{t?.stakes?.evolution_title ?? 'Evolution'}</span>
                    <span className="veb-shc-tt-v" style={{ color: 'var(--color-primary)' }}>{formatShortXRD(evolutionVal)} XRD</span>
                </div>
            )}
            {stakeVal > 0 && (
                <div className="veb-shc-tt-row">
                    <span className="veb-shc-tt-dot" style={{ background: '#22c55e' }} />
                    <span className="veb-shc-tt-k">{t?.stakes?.stake ?? 'Stake'}</span>
                    <span className="veb-shc-tt-v" style={{ color: '#22c55e' }}>+{formatShortXRD(stakeVal)} XRD</span>
                </div>
            )}
            {unstakeVal > 0 && (
                <div className="veb-shc-tt-row">
                    <span className="veb-shc-tt-dot" style={{ background: '#f59e0b' }} />
                    <span className="veb-shc-tt-k">{t?.stakes?.unstake ?? 'Unstake'}</span>
                    <span className="veb-shc-tt-v" style={{ color: '#f59e0b' }}>−{formatShortXRD(unstakeVal)} XRD</span>
                </div>
            )}
            {claimVal > 0 && (
                <div className="veb-shc-tt-row">
                    <span className="veb-shc-tt-dot" style={{ background: '#3b82f6' }} />
                    <span className="veb-shc-tt-k">{t?.stakes?.claim ?? 'Claim'}</span>
                    <span className="veb-shc-tt-v" style={{ color: '#3b82f6' }}>+{formatShortXRD(claimVal)} XRD</span>
                </div>
            )}
        </div>
    );
};

/* ─────────────────────────────────────────
   Axis value formatter
───────────────────────────────────────── */
const fmtAxis = (v: number) => {
    const abs = Math.abs(v);
    if (abs === 0) return '0';
    if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(abs / 1_000).toFixed(0)}K`;
    return abs.toString();
};

/* ─────────────────────────────────────────
   Stake Evolution Area Chart (3 months)
───────────────────────────────────────── */
export const StakeEvolutionChart = ({
    data, t, locale,
}: StakeEvolutionChartProps) => {
    // recharts ResponsiveContainer reads DOM dimensions — undefined on SSR.
    // useLayoutEffect fires synchronously before the browser paints, so the
    // chart renders immediately without any visible flash.
    // SSR and first client render both produce the empty placeholder → no
    // hydration mismatch → no re-mount → no modal animation on reload.
    const mounted = useMounted();
    if (!mounted) return <div className="veb-chart-recharts" style={{ minHeight: 220 }} />;

    const maxVal = Math.max(...data.map(d => d.totalStake), 0);
    const minVal = Math.min(...data.map(d => d.totalStake), maxVal);
    const domainMax = Math.ceil(maxVal * 1.05) || 1;
    const domainMin = Math.floor(minVal * 0.95) || 0;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

    return (
        <div className="veb-chart-recharts">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                    <defs>
                        <linearGradient id="evolGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 5" stroke="var(--color-card-border)" strokeOpacity={0.5} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} interval={30} padding={{ left: 6, right: 6 }} />
                    <YAxis domain={[domainMin, domainMax]} tickFormatter={fmtAxis} tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} width={44} tickCount={5} />
                    <Tooltip content={<StakeTooltip t={t} locale={locale} />} cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="totalStake" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#evolGrad)" isAnimationActive={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

/* ─────────────────────────────────────────
   Stake Activity Bidirectional Bar Chart (30 days)
───────────────────────────────────────── */
export const StakeHistoryChart = ({
    data, t, locale,
}: StakeHistoryChartProps) => {
    // Same hydration guard as StakeEvolutionChart.
    const mounted = useMounted();
    if (!mounted) return <div className="veb-chart-recharts" style={{ minHeight: 220 }} />;

    const chartData = data.map(d => ({
        date: d.date,
        stake: d.stake > 0 ? d.stake : null,
        unstakeNeg: d.unstake > 0 ? -d.unstake : null,
        claimNeg: d.claim > 0 ? -d.claim : null,
    }));

    const maxPos = Math.max(...data.map(d => d.stake), 0);
    const maxNeg = Math.max(...data.map(d => d.unstake + d.claim), 0);
    const domainMax = Math.ceil(maxPos * 1.18) || 1;
    const domainMin = -Math.ceil(maxNeg * 1.18) || -1;

    const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

    return (
        <div className="veb-chart-recharts">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barCategoryGap="15%" barGap={25}>
                    <defs>
                        <linearGradient id="stakeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} /><stop offset="100%" stopColor="#16a34a" stopOpacity={0.75} /></linearGradient>
                        <linearGradient id="unstakeGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.90} /><stop offset="100%" stopColor="#d97706" stopOpacity={0.65} /></linearGradient>
                        <linearGradient id="claimGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.90} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0.65} /></linearGradient>
                        <filter id="stakeGlow">  <feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                        <filter id="unstakeGlow"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                        <filter id="claimGlow">  <feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 5" stroke="var(--color-card-border)" strokeOpacity={0.5} vertical={false} />
                    <ReferenceLine y={0} stroke="var(--color-card-border)" strokeWidth={1.5} strokeOpacity={0.8} />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} interval={7} padding={{ left: 6, right: 6 }} />
                    <YAxis domain={[domainMin, domainMax]} tickFormatter={fmtAxis} tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} width={44} tickCount={5} />
                    <Tooltip content={<StakeTooltip t={t} locale={locale} />} cursor={{ fill: 'var(--color-text-muted)', opacity: 0.05, radius: 4 }} />
                    <Bar dataKey="stake" fill="url(#stakeGrad)" radius={[4, 4, 0, 0]} maxBarSize={32} filter="url(#stakeGlow)" isAnimationActive={false} activeBar={false} />
                    <Bar dataKey="unstakeNeg" fill="url(#unstakeGrad)" radius={[0, 0, 4, 4]} stackId="negative" maxBarSize={32} filter="url(#unstakeGlow)" isAnimationActive={false} activeBar={false} />
                    <Bar dataKey="claimNeg" fill="url(#claimGrad)" radius={[0, 0, 4, 4]} stackId="negative" maxBarSize={32} filter="url(#claimGlow)" isAnimationActive={false} activeBar={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};
