'use client';

/**
 * Where a validator's node runs and what it runs: three facts side by side,
 * each an icon beside a label over its value, centred on the same line.
 *
 * Shared by the expanded staking card and the explorer, under the status
 * badges. Each line is one entry of `buildNodeFacts`: a new fact is one more
 * entry there, and every placement picks it up.
 */
import React from 'react';
import { MapPin, Cpu, Server, type LucideIcon } from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import { formatPercent } from '@/utils/formatters';
import type { Validator } from '@/types/radix';
import type { DashboardDict } from '@/features/dashboard/types';
import { validatorLocation, validatorProvider, validatorVersion } from '../lib/validatorNode';

interface NodeFact {
    key: string;
    icon: LucideIcon;
    label: string;
    value: React.ReactNode;
    title?: string;
}

const Unknown = ({ label }: { label: string }) => (
    <span className="truncate font-semibold text-[var(--color-text-muted)]">{label}</span>
);

export function buildNodeFacts(
    validator: Validator,
    dt: Partial<DashboardDict> | undefined,
    locale: string,
): NodeFact[] {
    const details = dt?.details;
    const unknown = details?.unknown ?? 'Unknown';
    const location = validatorLocation(validator, locale);
    const version = validatorVersion(validator);
    const provider = validatorProvider(validator);
    const commit = sanitizeText(validator.commit);
    // The share of the delegated stake that sits with this provider, when the network was able to work it out.
    const providerShare = provider && validator.providerPercent > 0
        ? formatPercent(validator.providerPercent, validator.providerPercent < 10 ? 1 : 0, locale)
        : null;

    const facts: NodeFact[] = [
        {
            key: 'location',
            icon: MapPin,
            label: details?.location ?? 'Location',
            title: location ? [location.name, location.code].filter(Boolean).join(' · ') : undefined,
            value: location ? (
                <>
                    <span className="truncate">{location.name}</span>
                    {location.code && (
                        <span className="shrink-0 font-mono text-[10px] font-bold text-[var(--color-text-muted)]">{location.code}</span>
                    )}
                </>
            ) : <Unknown label={unknown} />,
        },
        {
            key: 'provider',
            icon: Server,
            label: details?.provider ?? 'Provider',
            title: provider ? [provider, providerShare].filter(Boolean).join(' · ') : undefined,
            value: provider ? (
                <>
                    <span className="truncate">{provider}</span>
                    {providerShare && (
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-[var(--color-text-muted)]">{providerShare}</span>
                    )}
                </>
            ) : <Unknown label={unknown} />,
        },
        {
            key: 'version',
            icon: Cpu,
            label: details?.node_version ?? 'Node version',
            title: version
                ? [version, commit].filter(Boolean).join(' · ')
                : details?.health_version_unobserved,
            value: version
                ? <span className="truncate font-mono tracking-tight">{version}</span>
                : <Unknown label={unknown} />,
        },
    ];

    return facts;
}

export function ValidatorNodeFacts({
    validator, dt, locale = 'en', className = '',
}: {
    validator: Validator;
    dt?: Partial<DashboardDict>;
    locale?: string;
    className?: string;
}) {
    const facts = buildNodeFacts(validator, dt, locale);

    return (
        <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 text-left sm:grid-cols-3 ${className}`}>
            {facts.map(({ key, icon: Icon, label, value, title }) => (
                <div key={key} title={title} className="group flex min-w-0 items-center gap-3">
                    <Icon className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col justify-center gap-0.5">
                        <dt className="truncate text-[10px] font-black uppercase leading-none tracking-widest text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-primary)]">
                            {label}
                        </dt>
                        <dd className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold leading-tight text-[var(--color-text-main)]">
                            {value}
                        </dd>
                    </div>
                </div>
            ))}
        </dl>
    );
}
