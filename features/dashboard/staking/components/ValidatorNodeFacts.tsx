'use client';

/**
 * Where a validator's node runs and what it runs, on one left-aligned row
 * that wraps only when the space runs out.
 *
 * Shared by the expanded staking card and the explorer, under the status
 * badges. Each line is one entry of `buildNodeFacts`: a new fact is one more
 * entry there, and every placement picks it up.
 */
import React from 'react';
import { MapPin, Cpu, Server, type LucideIcon } from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import type { Validator } from '@/types/radix';
import type { DashboardDict } from '@/features/dashboard/types';
import { validatorLocation, validatorVersion } from '../lib/validatorNode';

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
    const provider = sanitizeText(validator.provider);
    const commit = sanitizeText(validator.commit);

    const facts: (NodeFact | null)[] = [
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
        provider ? {
            key: 'provider',
            icon: Server,
            label: details?.provider ?? 'Provider',
            title: provider,
            value: <span className="truncate">{provider}</span>,
        } : null,
    ];

    return facts.filter((fact): fact is NodeFact => fact !== null);
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
        <dl className={`flex flex-wrap items-center justify-start gap-x-5 gap-y-1.5 text-left ${className}`}>
            {facts.map(({ key, icon: Icon, label, value, title }) => (
                <div key={key} title={title} className="group flex min-w-0 max-w-full items-center gap-2">
                    <Icon className="size-3.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                    <dt className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-primary)]">
                        {label}
                    </dt>
                    <dd className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-[var(--color-text-main)]">
                        {value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
