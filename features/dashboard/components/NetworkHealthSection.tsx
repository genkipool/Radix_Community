'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, Server, ShieldAlert, ShieldCheck, ShieldQuestion, TriangleAlert, Info, type LucideIcon } from 'lucide-react';
import { formatPercent, formatXRD } from '@/utils/formatters';
import { StatCard } from './StatCard';
import { TONES } from '../staking/lib/validatorHealth';
import {
    assessDecentralization, countryDistribution, hostingShare, MIN_COVERAGE, providerDistribution, versionAdoption, VERSION_FRESH_MS,
    type Level,
} from '../staking/lib/networkHealth';
import { apiFetchNodeRelease } from '../services/apiClient';
import type { TranslationsT } from '../types';
import type { Validator } from '@/types/radix';

interface NetworkHealthSectionProps {
    validators: Validator[];
    dt?: Partial<TranslationsT['dashboard']>;
    locale: string;
}

const LEVELS: Record<Level, { icon: LucideIcon; color: string }> = {
    strong: { icon: ShieldCheck, color: TONES.positive },
    moderate: { icon: ShieldAlert, color: TONES.warning },
    weak: { icon: TriangleAlert, color: TONES.danger },
    insufficient: { icon: ShieldQuestion, color: TONES.neutral },
};

/** Fills `{name}` placeholders of a translated sentence. */
const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

/** How many providers the inline value names; the full list is in the card's tooltip. */
const INLINE_PROVIDERS = 3;
const LISTED_PROVIDERS = 10;
const freshMinutes = VERSION_FRESH_MS / 60_000;
/** How often the published release is checked; the server caches GitHub's answer as long. */
const RELEASE_REFRESH_MS = 15 * 60_000;

/**
 * How current and how spread out the active validator set is, as one more row of
 * cards under the flow figures: nodes on the latest release, validators by
 * hosting provider, and a verdict worked out from those numbers by a stated rule —
 * with the reasoning written out below. Computed from the validator list the page
 * already holds, so it asks for nothing.
 */
export function NetworkHealthSection({ validators, dt, locale }: NetworkHealthSectionProps) {
    const t = dt?.insights;
    // The latest node release, as published on GitHub: what "latest" means here.
    // While it loads, or if GitHub cannot be read, the highest release the validators run stands in.
    const { data: release } = useQuery({
        queryKey: ['node-release'],
        queryFn: apiFetchNodeRelease,
        staleTime: RELEASE_REFRESH_MS,
        refetchInterval: RELEASE_REFRESH_MS,
        retry: 1,
    });
    const version = versionAdoption(validators, { release: release?.version });
    const providers = providerDistribution(validators);
    const countries = countryDistribution(validators);
    const hosting = hostingShare(validators);
    const verdict = assessDecentralization(providers);
    const byCountry = assessDecentralization(countries);
    const stakeTop = [...providers.shares].toSorted((a, b) => b.stakePercent - a.stakePercent)[0];
    const pct = (value: number) => formatPercent(value, value < 10 ? 1 : 0, locale);
    const { icon: LevelIcon, color } = LEVELS[verdict.level];

    const unknown = providers.total - providers.known;
    const providerList = providers.shares
        .slice(0, LISTED_PROVIDERS)
        .map(s => `${s.name} ${pct(s.percent)} (${s.count})`)
        .join('\n');
    const providerTooltip = [
        t?.providers_title,
        providerList || t?.unknown_label,
        unknown > 0 ? `${t?.unknown_label ?? 'Unknown'}: ${pct((unknown / providers.total) * 100)} (${unknown})` : '',
    ].filter(Boolean).join('\n');

    const conclusion = verdict.level === 'insufficient'
        ? fill(t?.conclusion_insufficient ?? '', { known: providers.known, total: providers.total, min: Math.round(MIN_COVERAGE * 100) })
        : fill(t?.[`conclusion_${verdict.level}` as 'conclusion_strong'] ?? '', {
            top: verdict.top?.name ?? '', percent: verdict.top ? pct(verdict.top.percent) : '', n: verdict.nakamotoValidators ?? '',
        });

    return (
        <section className="mt-3" aria-label={t?.health_title}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <StatCard
                    wrap
                    icon={<Cpu className="size-5" />}
                    label={t?.version_title ?? 'On the latest version'}
                    value={version.latest
                        ? (
                            <>
                                {version.updated}/{version.total} · {formatPercent(version.percent, 2, locale)}
                                {/* The same adoption weighted by stake: what share of the XRD delegated to active validators runs the latest release. */}
                                {version.totalStake > 0 && (
                                    <span title={t?.version_stake_title}>
                                        {' · '}{formatXRD(version.updatedStake, locale)}/{formatXRD(version.totalStake, locale)} XRD · {formatPercent(version.stakePercent, 2, locale)}
                                    </span>
                                )}
                            </>
                        )
                        : '---'}
                    accent
                    description={[
                        version.latest
                            ? fill((version.source === 'release' ? t?.version_hint_release : t?.version_hint) ?? '', { latest: version.latest, minutes: freshMinutes })
                            : fill(t?.version_none ?? '', { minutes: freshMinutes }),
                        version.latest && version.totalStake > 0 ? fill(t?.version_stake ?? '', { percent: formatPercent(version.stakePercent, 2, locale) }) : '',
                        version.unknown > 0 ? fill(t?.version_unknown ?? '', { n: version.unknown, minutes: freshMinutes }) : '',
                    ].filter(Boolean).join(' ')}
                />
                <StatCard
                    wrap
                    icon={<Server className="size-5" />}
                    label={t?.providers_title ?? 'Validators by provider'}
                    value={providers.shares.length > 0
                        ? providers.shares.slice(0, INLINE_PROVIDERS).map(s => `${s.name} ${pct(s.percent)}`).join(' · ')
                        : '---'}
                    description={providerTooltip}
                />
                <StatCard
                    wrap
                    icon={<LevelIcon className="size-5" style={{ color }} />}
                    label={t?.conclusion_title ?? 'Decentralization'}
                    value={(
                        <>
                            <span className="font-black uppercase tracking-wide" style={{ color }}>
                                {t?.[`level_${verdict.level}` as 'level_strong']}
                            </span>
                            {/* The figure the verdict rests on: the biggest provider's share, or how much is known when it is too little to judge. */}
                            <span className="text-[var(--color-text-muted)]">
                                {' · '}
                                {verdict.level === 'insufficient'
                                    ? `${pct(verdict.coverage * 100)} ${t?.known_label ?? 'known'}`
                                    : verdict.top ? `${verdict.top.name} ${pct(verdict.top.percent)}` : ''}
                            </span>
                        </>
                    )}
                    description={conclusion}
                />
            </div>

            <div className="mt-3 space-y-1.5 text-sm text-[var(--color-text-main)]">
                <p>{conclusion}</p>
                {verdict.level !== 'insufficient' && stakeTop && verdict.nakamotoStake !== null && (
                    <p className="text-[var(--color-text-muted)]">{fill(t?.conclusion_stake ?? '', { top: stakeTop.name, percent: pct(stakeTop.stakePercent), n: verdict.nakamotoStake })}</p>
                )}
                {byCountry.level !== 'insufficient' && byCountry.top && byCountry.nakamotoValidators !== null && (
                    <p className="text-[var(--color-text-muted)]">{fill(t?.conclusion_countries ?? '', { top: byCountry.top.name, percent: pct(byCountry.top.percent), n: byCountry.nakamotoValidators })}</p>
                )}
                {hosting && (
                    <p className="text-[var(--color-text-muted)]">{fill(t?.conclusion_hosting ?? '', { percent: pct(hosting.percent) })}</p>
                )}
            </div>
            <p className="mt-2 flex items-start gap-2 text-[11px] text-[var(--color-text-muted)]">
                <Info className="size-3.5 shrink-0 mt-px" />
                <span>{t?.conclusion_rule}</span>
            </p>
        </section>
    );
}
