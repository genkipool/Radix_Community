'use client';

import React from 'react';
import { ShieldCheck, ShieldAlert, TriangleAlert, Siren, Gauge, type LucideIcon } from 'lucide-react';
import { formatPercent } from '@/utils/formatters';
import { TONES, toneStyle } from '../staking/lib/validatorHealth';
import { levelOf, sellPressure, SOON_DAYS, type PressureInput, type PressureKey, type PressureLevel } from '../staking/lib/sellPressure';
import type { TranslationsT } from '../types';

interface SellPressureGaugeProps extends PressureInput {
    dt?: Partial<TranslationsT['dashboard']>;
    locale: string;
}

/** Severity colours; each level also has its own icon and word, so colour is never the only sign. */
const LEVELS: Record<PressureLevel, { icon: LucideIcon; color: string }> = {
    low: { icon: ShieldCheck, color: TONES.positive },
    moderate: { icon: ShieldAlert, color: TONES.warning },
    high: { icon: TriangleAlert, color: TONES.danger },
    severe: { icon: Siren, color: TONES.danger },
};

const ORDER: PressureKey[] = ['size', 'liquidity', 'trend', 'imminence'];

const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** A meter: the fill carries the severity, the unfilled track is a lighter step of the same colour. */
function Meter({ score, color, height }: { score: number; color: string; height: string }) {
    return (
        <div
            className={`${height} rounded-full overflow-hidden`}
            style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
            role="img"
            aria-label={`${Math.round(score)}/100`}
        >
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: color }} />
        </div>
    );
}

/**
 * The sell-pressure thermometer: one reading from 0 to 100 for the XRD now
 * unlocking, and the four things it is made of, each with its own meter and the
 * measure behind it — so a reader can see WHY it reads as it does, and judge
 * for themselves. It states what it is not: unlocked XRD is not sold XRD.
 */
export function SellPressureGauge({ dt, locale, ...input }: SellPressureGaugeProps) {
    const t = dt?.insights;
    const pressure = sellPressure(input);
    const byKey = new Map(pressure.components.map(c => [c.key, c]));
    const level = pressure.level;
    const { icon: LevelIcon, color } = level ? LEVELS[level] : { icon: Gauge, color: TONES.neutral };
    const levelLabel = level ? t?.[`pressure_level_${level}` as 'pressure_level_low'] : t?.pressure_unknown;
    const pct = (value: number) => formatPercent(value, Math.abs(value) < 10 ? 1 : 0, locale);

    /** The measure behind each component, in words. */
    const measure = (key: PressureKey, value: number): string => {
        switch (key) {
            case 'size': return fill(t?.pressure_size_value ?? '', { v: pct(value) });
            case 'liquidity': return fill(t?.pressure_liquidity_value ?? '', { v: value.toLocaleString(locale, { maximumFractionDigits: value < 10 ? 2 : 1 }) });
            case 'trend': return fill(t?.pressure_trend_value ?? '', { v: `${value >= 0 ? '+' : '\u2212'}${pct(Math.abs(value))}` });
            case 'imminence': return fill(t?.pressure_imminence_value ?? '', { v: pct(value), n: SOON_DAYS });
        }
    };

    return (
        <div className="min-w-0">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-black uppercase tracking-wider text-[var(--color-text-main)]">{t?.pressure_title ?? 'Sell-pressure thermometer'}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t?.pressure_subtitle}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide" style={toneStyle(color)}>
                    <LevelIcon className="size-3.5" aria-hidden="true" />
                    {levelLabel}
                </span>
            </div>

            {pressure.score === null ? (
                <p className="text-sm text-[var(--color-text-muted)]">{t?.pressure_unknown_detail}</p>
            ) : (
                <>
                    <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-4xl font-black text-[var(--color-text-main)]">{Math.round(pressure.score)}</span>
                        <span className="text-sm font-bold text-[var(--color-text-muted)]">/ 100</span>
                    </div>
                    <Meter score={pressure.score} color={color} height="h-3" />
                    <div className="mt-1 grid grid-cols-4 text-[10px] text-[var(--color-text-muted)]" aria-hidden="true">
                        {(['low', 'moderate', 'high', 'severe'] as const).map(l => (
                            <span key={l} className={`${l === 'low' ? 'text-left' : l === 'severe' ? 'text-right' : 'text-center'} ${l === level ? 'font-bold text-[var(--color-text-main)]' : ''}`}>
                                {t?.[`pressure_level_${l}` as 'pressure_level_low']}
                            </span>
                        ))}
                    </div>
                </>
            )}

            <ul className="mt-5 space-y-3">
                {ORDER.map(key => {
                    const component = byKey.get(key);
                    const label = t?.[`pressure_${key}` as 'pressure_size'];
                    if (!component) {
                        return (
                            <li key={key} className="text-xs">
                                <div className="font-bold text-[var(--color-text-muted)]">{label}</div>
                                <div className="text-[var(--color-text-muted)] italic">{t?.[`pressure_${key}_missing` as 'pressure_size_missing']}</div>
                            </li>
                        );
                    }
                    const componentLevel = levelOf(component.score);
                    return (
                        <li key={key} className="text-xs" title={t?.[`pressure_${key}_desc` as 'pressure_size_desc']}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <span className="font-bold text-[var(--color-text-main)]">
                                    {label}
                                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                                        {t?.[`pressure_level_${componentLevel}` as 'pressure_level_low']}
                                    </span>
                                </span>
                                <span className="text-[var(--color-text-muted)]">{measure(key, component.value)}</span>
                            </div>
                            <div className="mt-1">
                                <Meter score={component.score} color={LEVELS[componentLevel].color} height="h-1.5" />
                            </div>
                        </li>
                    );
                })}
            </ul>

            <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">{t?.pressure_rule}</p>
        </div>
    );
}
