'use client';

import React from 'react';
import {
    Sparkles, Package, Box, Wallet, Fingerprint, Droplets,
    ShieldCheck, Lock, KeyRound, UserRound, Code2, Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { SafeImage } from '@/components/ui/SafeImage';
import { sanitizeText } from '@/utils/sanitize';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import type { EntityCreation, EntityCreationKind } from '../utils/entityCreationUtils';
import {
    AddressChip,
    CopyButton,
    FactGrid,
    FactTile,
    PlainSummary,
    SectionLabel,
    SummaryBody,
    SummaryCard,
    SummaryHero,
    shortenAddress,
} from './SummaryCardKit';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;
type Ec = Partial<NonNullable<TranslationsT['dashboard']['transactions']['entity_creation']>>;

interface EntityCreationCardProps {
    creation: EntityCreation;
    creator: string | null;
    tt?: Tt;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
}

const KIND_ICON: Record<EntityCreationKind, LucideIcon> = {
    package: Package,
    component: Box,
    account: Wallet,
    identity: Fingerprint,
    pool: Droplets,
    validator: ShieldCheck,
    locker: Lock,
    access_controller: KeyRound,
    other: Sparkles,
};

/**
 * EntityCreationCard
 * Visual summary card for any newly created non-resource global entity
 * (packages, components, accounts, identities, pools, validators, lockers,
 * access controllers).
 */
export function EntityCreationCard({
    creation, creator, tt, onCopy, copiedAddress, onResourceClick, network,
}: EntityCreationCardProps) {
    const ec: Ec = tt?.entity_creation ?? {};
    const live = useEntityData(creation.address, network);
    const badge = useEntityData(creation.ownerBadge ?? '', network);

    const KindIcon = KIND_ICON[creation.kind];
    const copyTitle = tt?.copy_raw ?? '';

    const titleByKind: Record<EntityCreationKind, string> = {
        package: ec.title_package ?? '',
        component: ec.title_component ?? '',
        account: ec.title_account ?? '',
        identity: ec.title_identity ?? '',
        pool: ec.title_pool ?? '',
        validator: ec.title_validator ?? '',
        locker: ec.title_locker ?? '',
        access_controller: ec.title_access_controller ?? '',
        other: ec.title_other ?? '',
    };

    const kindLabelByKind: Record<EntityCreationKind, string> = {
        package: ec.kind_package ?? '',
        component: ec.kind_component ?? '',
        account: ec.kind_account ?? '',
        identity: ec.kind_identity ?? '',
        pool: ec.kind_pool ?? '',
        validator: ec.kind_validator ?? '',
        locker: ec.kind_locker ?? '',
        access_controller: ec.kind_access_controller ?? '',
        other: creation.entityType || (ec.kind_other ?? ''),
    };

    const kindLabel = kindLabelByKind[creation.kind];
    const name = creation.name || live?.name || creation.blueprintName || kindLabel;
    const iconUrl = creation.iconUrl || live?.iconUrl || null;

    const summary = (() => {
        if (creation.kind === 'package') {
            if (creation.blueprints.length > 0) {
                return (ec.summary_package_blueprints ?? '')
                    .replace('{name}', name)
                    .replace('{count}', String(creation.blueprints.length))
                    .replace('{blueprints}', creation.blueprints.join(', '));
            }
            return (ec.summary_package ?? '').replace('{name}', name);
        }
        if (creation.kind === 'component' && creation.blueprintName) {
            return (ec.summary_component_blueprint ?? '')
                .replace('{name}', name)
                .replace('{blueprint}', creation.blueprintName);
        }
        if (creation.kind === 'account') return ec.summary_account ?? '';
        if (creation.kind === 'identity') return ec.summary_identity ?? '';
        if (creation.kind === 'pool') return (ec.summary_pool ?? '').replace('{blueprint}', creation.blueprintName || kindLabel);
        if (creation.kind === 'validator') return (ec.summary_validator ?? '').replace('{name}', name);
        if (creation.kind === 'locker') return ec.summary_locker ?? '';
        if (creation.kind === 'access_controller') return ec.summary_access_controller ?? '';
        return (ec.summary_generic ?? '')
            .replace('{kind}', kindLabel.toLowerCase())
            .replace('{name}', name);
    })();

    const depositRuleLabel = (rule: string) => {
        if (rule === 'Accept') return ec.deposit_accept ?? rule;
        if (rule === 'Reject') return ec.deposit_reject ?? rule;
        if (rule === 'AllowExisting') return ec.deposit_allow_existing ?? rule;
        return rule;
    };

    return (
        <SummaryCard icon={Sparkles} title={titleByKind[creation.kind]}>
            <SummaryHero>
                <div className="flex flex-col @md:flex-row @md:items-center gap-4">
                    <div className="relative shrink-0 self-start">
                        <div className="size-14 @md:size-16 rounded-2xl overflow-hidden bg-transparent border border-[var(--color-card-border)] grid place-items-center">
                            {iconUrl
                                ? <SafeImage src={iconUrl} alt={name} fallbackName={name} className="size-full object-contain" />
                                : <KindIcon className="size-7 text-[var(--color-primary)]" />}
                        </div>
                        <span className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md">
                            <Sparkles className="size-2.5" />
                            {ec.new_badge ?? ''}
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-base @md:text-lg font-bold text-[var(--color-text-main)] break-words">{name}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 min-w-0">
                            <button
                                type="button"
                                onClick={() => onResourceClick?.(creation.address)}
                                disabled={!onResourceClick}
                                className="font-mono text-xs text-[var(--color-text-secondary)] truncate enabled:hover:text-[var(--color-primary)] enabled:underline decoration-[var(--color-primary)]/30 underline-offset-2 transition-colors text-left"
                                title={creation.address}
                            >
                                {shortenAddress(creation.address)}
                            </button>
                            <CopyButton value={creation.address} copiedAddress={copiedAddress} onCopy={onCopy} title={copyTitle} />
                        </div>
                        {creation.description && (
                            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">{creation.description}</p>
                        )}
                        {creation.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {creation.tags.map((tag) => (
                                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[var(--color-text-muted)]">#{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </SummaryHero>

            <SummaryBody>
                <PlainSummary>{summary}</PlainSummary>

                <FactGrid>
                    {creator && (
                        <FactTile icon={UserRound} label={ec.created_by ?? ''}>
                            <AddressChip address={creator} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                        </FactTile>
                    )}

                    {creation.blueprintName && (
                        <FactTile
                            icon={Code2}
                            label={ec.blueprint ?? ''}
                            hint={creation.blueprintVersion ? `v${creation.blueprintVersion}` : undefined}
                        >
                            <span className="font-mono text-xs truncate block" title={creation.blueprintName}>{creation.blueprintName}</span>
                        </FactTile>
                    )}

                    {creation.packageAddress && (
                        <FactTile icon={Package} label={ec.package ?? ''}>
                            <span className="flex items-center gap-1 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => onResourceClick?.(creation.packageAddress as string)}
                                    disabled={!onResourceClick}
                                    className="font-mono text-xs truncate text-left enabled:hover:text-[var(--color-primary)] transition-colors"
                                    title={creation.packageAddress}
                                >
                                    {shortenAddress(creation.packageAddress)}
                                </button>
                                <CopyButton value={creation.packageAddress} copiedAddress={copiedAddress} onCopy={onCopy} title={copyTitle} />
                            </span>
                        </FactTile>
                    )}

                    {creation.defaultDepositRule && (
                        <FactTile icon={Shield} label={ec.deposit_rule ?? ''}>
                            <span>{depositRuleLabel(creation.defaultDepositRule)}</span>
                        </FactTile>
                    )}

                    <FactTile icon={KeyRound} label={ec.controlled_by ?? ''}>
                        {creation.ownerBadge ? (
                            <span className="flex items-center gap-2 min-w-0">
                                {badge?.iconUrl && (
                                    <SafeImage src={badge.iconUrl} alt={badge.name || ''} fallbackName={badge.name || ''} zoomable={false} className="size-5 rounded-full border border-[var(--color-card-border)] object-cover shrink-0" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => onResourceClick?.(creation.ownerBadge as string)}
                                    disabled={!onResourceClick}
                                    className="truncate text-left text-xs font-mono enabled:hover:text-[var(--color-primary)] transition-colors"
                                    title={creation.ownerBadge}
                                >
                                    {badge?.name || shortenAddress(creation.ownerBadge)}
                                </button>
                            </span>
                        ) : (
                            <span className="text-[var(--color-text-secondary)] text-xs">{ec.no_owner ?? ''}</span>
                        )}
                    </FactTile>
                </FactGrid>

                {creation.kind === 'package' && creation.blueprints.length > 0 && (
                    <div>
                        <SectionLabel>{ec.published_blueprints ?? ''}</SectionLabel>
                        <div className="flex flex-wrap gap-1.5">
                            {creation.blueprints.map((bp) => (
                                <span
                                    key={bp}
                                    className="font-mono text-[11px] px-2 py-1 rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                >
                                    {sanitizeText(bp)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </SummaryBody>
        </SummaryCard>
    );
}
