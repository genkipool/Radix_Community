/**
 * How a validator's state reads on screen: label, colour and the sentence
 * explaining it.
 *
 * Every badge and pill showing "online", "accepts connection" or a yes/no
 * state goes through here, on the staking cards and in the explorer alike, so
 * the three health states and their reasons are worded once.
 */
import type { CSSProperties } from 'react';
import type { OnlineReason, Validator } from '@/types/radix';
import type { DashboardDict } from '@/features/dashboard/types';

type Details = Partial<DashboardDict['details']> | undefined;

/** Colours a state can take. Theme variables wherever the theme defines one. */
export const TONES = {
    positive: '#16a34a',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    neutral: 'var(--color-text-muted)',
    primary: 'var(--color-primary)',
} as const;

/**
 * Text, border and fill of a badge from a single colour. `color-mix` works
 * with hex values and theme variables alike, where appending an alpha suffix
 * to a `var()` produced invalid CSS.
 */
export function toneStyle(color: string): CSSProperties {
    return {
        color,
        borderColor: `color-mix(in srgb, ${color} 27%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
    };
}

export interface StateDisplay {
    label: string;
    /** Why it reads this way, for the tooltip. */
    title: string;
    color: string;
}

const ONLINE_REASONS: Record<OnlineReason, string> = {
    producing: 'It is proposing blocks in consensus.',
    missing_proposals: 'It made no proposal in the last epochs: its node is not validating.',
    connected: 'Connected to our node right now.',
    reachable: 'Its network port answers.',
    unreachable: 'Its network port does not answer.',
    no_data: 'Our node has no data about this validator.',
};

export function onlineDisplay(validator: Validator, details: Details): StateDisplay {
    const reason = validator.onlineReason ?? (validator.onlineStatus === null ? 'no_data' : undefined);
    const title = reason ? (details?.[`health_${reason}`] ?? ONLINE_REASONS[reason]) : '';

    if (validator.onlineStatus === true) {
        return { label: details?.online ?? 'Online', title, color: TONES.positive };
    }
    if (validator.onlineStatus === false) {
        // Not validating is worse than a closed port: it costs delegators rewards.
        const color = reason === 'missing_proposals' ? TONES.danger : TONES.warning;
        return { label: details?.offline ?? 'Offline', title, color };
    }
    return { label: details?.health_online_unknown ?? 'No data', title, color: TONES.neutral };
}

export function connectDisplay(validator: Validator, details: Details): StateDisplay {
    if (validator.acceptsConnect === true) {
        return {
            label: details?.accepts_connect ?? 'Accepts Connection',
            title: details?.health_connect_yes ?? 'Its network port accepts inbound connections.',
            color: TONES.positive,
        };
    }
    if (validator.acceptsConnect === false) {
        return {
            label: details?.no_accepts_connect ?? 'No Connect',
            title: details?.health_connect_no ?? 'Its network port does not accept inbound connections.',
            color: TONES.warning,
        };
    }
    return {
        label: details?.health_connect_unknown ?? 'Unchecked',
        title: details?.health_connect_none ?? 'No address of its node is known to check it.',
        color: TONES.neutral,
    };
}

/** A plain yes/no state, such as active or accepting stake. */
export function binaryDisplay(on: boolean, labelOn: string, labelOff: string): StateDisplay {
    const label = on ? labelOn : labelOff;
    return { label, title: label, color: on ? TONES.positive : TONES.warning };
}

export function stakeDisplay(validator: Validator, details: Details): StateDisplay {
    return binaryDisplay(
        validator.externalStakeAccepted,
        details?.accepts_stake ?? 'Accepts Stake',
        details?.no_accepts_stake ?? 'No Stake',
    );
}
