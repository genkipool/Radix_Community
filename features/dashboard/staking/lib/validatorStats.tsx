/**
 * The figures a validator card shows, built once for every layout.
 *
 * The four card layouts differ in how much room they have, not in what they
 * report: stake, fee, APY, effective fee, uptime and delegators, in that
 * order. Each used to spell the six out by hand with its own decimal count,
 * which is how the same validator could read 4,9% in a dense grid and 4,95%
 * one column wider. The numbers live here now, at two decimals everywhere,
 * and a layout only decides how to draw them.
 */
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { formatNumber, formatPercent, formatXRD, formatXRDExact } from '@/utils/formatters';
import { getUptimeColor, getUptimeTooltipText } from '@/utils/validators';
import type { Validator } from '@/types/radix';
import type { DashboardDict } from '@/features/dashboard/types';
import type { StatItem } from '../types/components.types';

/** Decimals every validator figure is shown with, whatever the layout. */
const DECIMALS = 2;

/** Past this share of the network stake, more delegation hurts the network. */
const SHARE_WARNING_PERCENT = 2;

const WARNING_COLOR = '#dc2626';

export type ValidatorStatKey =
    | 'stake'
    | 'fee'
    | 'apy'
    | 'effectiveFee'
    | 'uptime'
    | 'delegators';

export interface ValidatorStat extends StatItem {
    key: ValidatorStatKey;
}

interface BuildOptions {
    /**
     * Dense layouts drop the network share next to the stake unless it is
     * high enough to be a warning, which is the only time it earns the space.
     */
    compact?: boolean;
}

/** Joins a figure with the sentence explaining it, for a `title` tooltip. */
const tooltipWith = (detail: string, explanation?: string) =>
    explanation ? `${detail} · ${explanation}` : detail;

export function buildValidatorStats(
    validator: Validator,
    dt: DashboardDict | undefined,
    locale: string = 'en',
    { compact = false }: BuildOptions = {},
): ValidatorStat[] {
    const card = dt?.card;
    const details = dt?.details;
    const tips = card?.tooltips;

    const overweight = validator.delegatedStakePercent > SHARE_WARNING_PERCENT;
    const showShare = overweight || !compact;

    return [
        {
            key: 'stake',
            label: card?.stake ?? 'Total Stake',
            tooltip: tooltipWith(
                formatXRDExact(validator.delegatedStake, locale),
                overweight ? tips?.share_warning : tips?.stake,
            ),
            accent: overweight ? WARNING_COLOR : undefined,
            value: (
                <span className="inline-flex items-baseline gap-1.5">
                    <span>{formatXRD(validator.delegatedStake, locale)}</span>
                    {showShare && (
                        <span className={`text-[10px] font-medium ${overweight ? '' : 'opacity-50'}`}>
                            ({formatPercent(validator.delegatedStakePercent, DECIMALS, locale)})
                        </span>
                    )}
                </span>
            ),
        },
        {
            key: 'fee',
            label: card?.fee ?? 'Fee',
            tooltip: validator.hasPendingFeeChange
                ? `${tips?.pending_fee} (-> ${validator.upcomingFee}%)`
                : tips?.fee,
            value: (
                <span className="inline-flex items-center gap-1">
                    <span>{formatPercent(validator.nominalFee, DECIMALS, locale)}</span>
                    {validator.hasPendingFeeChange && (
                        <AlertCircle className="size-3 shrink-0 text-amber-500 animate-pulse" />
                    )}
                </span>
            ),
        },
        {
            key: 'apy',
            label: card?.apy ?? 'APY',
            tooltip: tips?.apy,
            value: formatPercent(validator.apyProjection, DECIMALS, locale),
        },
        {
            key: 'effectiveFee',
            label: details?.effective_fee ?? 'Effective Fee',
            tooltip: tips?.effective_fee,
            value: formatPercent(validator.effectiveFee, DECIMALS, locale),
        },
        {
            key: 'uptime',
            label: card?.uptime_14d ?? 'Uptime 14d',
            tooltip: getUptimeTooltipText(validator.recentUptime, true, details),
            accent: getUptimeColor(validator.recentUptime),
            value: formatPercent(validator.recentUptime, DECIMALS, locale),
        },
        {
            key: 'delegators',
            label: details?.delegators ?? 'Delegators',
            tooltip: tips?.delegators,
            value: formatNumber(validator.delegators, 0, locale),
        },
    ];
}
