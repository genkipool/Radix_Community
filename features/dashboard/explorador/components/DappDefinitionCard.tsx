'use client';

import Link from 'next/link';
import { BadgeCheck, CircleAlert, ExternalLink } from 'lucide-react';

import { SafeImage } from '@/components/ui/SafeImage';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import type { MetadataItem, Network, TranslationsT } from '@/features/dashboard/types';
import { useExplorerEntity } from './ExplorerEntityCard';
import { AddressChip } from './SummaryCardKit';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

/** A metadata value as one string or a list of them. */
const metaValues = (items: MetadataItem[] | undefined, key: string): string[] => {
    const typed = items?.find((m) => m.key === key)?.value?.typed as { value?: unknown; values?: unknown[] } | undefined;
    if (!typed) return [];
    if (Array.isArray(typed.values)) return typed.values.map(String);
    return typed.value !== undefined && typed.value !== null ? [String(typed.value)] : [];
};

/**
 * The dApp an entity names as its dApp definition, as people know it: icon,
 * name, description, tags and websites, and whether the link holds both ways
 * (the dApp claims the entity back in `claimed_entities`; otherwise anyone
 * could name a well-known dApp). One read of the dApp's details, from the
 * explorer's shared cache.
 */
export function DappDefinitionCard({ dapp, claimant, network, locale, tt, copiedAddress, onCopy }: {
    /** The dApp definition account. */
    dapp: string;
    /** The entity that names it, checked against what the dApp claims. */
    claimant: string;
    network: Network;
    locale: string;
    tt?: Tt;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
}) {
    const { data } = useExplorerEntity(dapp, network);
    const items = data?.metadata?.items;
    const name = metaValues(items, 'name')[0];
    const icon = metaValues(items, 'icon_url')[0];
    const description = metaValues(items, 'description')[0];
    const tags = metaValues(items, 'tags');
    const websites = metaValues(items, 'claimed_websites');
    const verified = metaValues(items, 'claimed_entities').includes(claimant);
    const label = name || tt?.dapp_unnamed || 'Unnamed dApp';

    return (
        <section className="flex flex-col gap-2">
            <h4 className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">{tt?.dapp_title || 'dApp'}</h4>
            <div className="flex items-start gap-3 min-w-0">
                {icon ? (
                    <SafeImage src={icon} alt={label} fallbackName={label} className="size-10 rounded-xl object-cover shrink-0" />
                ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--color-primary)]/10 text-xs font-black text-[var(--color-primary)]">
                        {label.slice(0, 2).toUpperCase()}
                    </span>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <Link href={dashboardRoutes.entity(locale, dapp, { network })} className="text-sm font-bold text-[var(--color-text-main)] hover:text-[var(--color-primary)] hover:underline">
                            {data ? label : '…'}
                        </Link>
                        {data && (
                            <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${verified ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}
                                title={verified ? tt?.dapp_verified_hint : tt?.dapp_unverified_hint}
                            >
                                {verified ? <BadgeCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}
                                {verified ? tt?.dapp_verified || 'Verified' : tt?.dapp_unverified || 'Not confirmed'}
                            </span>
                        )}
                    </div>
                    {description && <p className="text-xs text-[var(--color-text-muted)]">{description}</p>}
                    <AddressChip address={dapp} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={tt?.copy_address || 'Copy'} />
                    {(websites.length > 0 || tags.length > 0) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px]">
                            {websites.map((site) => (
                                <a key={site} href={site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline">
                                    {site.replace(/^https?:\/\//, '')}
                                    <ExternalLink className="size-3" />
                                </a>
                            ))}
                            {tags.length > 0 && <span className="text-[var(--color-text-muted)]">{tags.join(' · ')}</span>}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
