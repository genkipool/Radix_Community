'use client';

import React from 'react';
import {
    Sparkles, Info, Layers, Coins, Send, PlusCircle, Flame, Undo2,
    UserRound, KeyRound, Fingerprint, Pencil, Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { SafeImage } from '@/components/ui/SafeImage';
import { sanitizeText } from '@/utils/sanitize';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import type { ResourceCreation, RoleHolder } from '../utils/resourceCreationUtils';
import { CopyButton, FactTile, shortenAddress } from './SummaryCardKit';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;
type Rc = Partial<NonNullable<TranslationsT['dashboard']['transactions']['resource_creation']>>;

interface ResourceCreationCardProps {
    creation: ResourceCreation;
    creator: string | null;
    tt?: Tt;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
}

const HOLDER_STYLE: Record<RoleHolder, string> = {
    anyone: 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/25',
    owner: 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/25',
    restricted: 'text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 border-[var(--color-secondary)]/25',
    nobody: 'text-[var(--color-text-muted)] bg-[var(--color-surface)] border-[var(--color-card-border)]',
};

function CapabilityRow({ icon: Icon, label, holder, text }: { icon: LucideIcon; label: string; holder: RoleHolder; text: string }) {
    const off = holder === 'nobody';
    return (
        <li className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-3 py-2.5">
            <span className={`flex items-center gap-2.5 min-w-0 text-[13px] ${off ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`}>
                <span className={`grid place-items-center size-7 rounded-lg border shrink-0 ${HOLDER_STYLE[holder]}`}>
                    <Icon className="size-3.5" />
                </span>
                <span className="leading-snug">{label}</span>
            </span>
            <span className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-md border whitespace-nowrap ${HOLDER_STYLE[holder]}`}>
                {text}
            </span>
        </li>
    );
}

/**
 * ResourceCreationCard
 * Explains, in plain words, a transaction that brings a new NFT collection or
 * token into existence: what it is, how much of it exists now and what its
 * rules allow from here on.
 */
export function ResourceCreationCard({
    creation, creator, tt, onCopy, copiedAddress, onResourceClick, network, locale,
}: ResourceCreationCardProps) {
    const rc: Rc = tt?.resource_creation ?? {};
    const live = useEntityData(creation.address, network);
    const badge = useEntityData(creation.ownerBadge ?? '', network);

    const isNft = creation.kind === 'non_fungible';
    const name = creation.name || live?.name || rc.unnamed || 'Unnamed';
    const symbol = creation.symbol || live?.symbol || null;
    const iconUrl = creation.iconUrl || live?.iconUrl || null;
    const supply = parseFloat(creation.initialSupply) || 0;
    const supplyText = supply.toLocaleString(locale, { maximumFractionDigits: creation.divisibility ?? 18 });
    const copyTitle = tt?.copy_raw || 'Copy';
    const KindIcon = isNft ? Layers : Coins;

    const summary = (() => {
        const tpl = isNft
            ? (supply > 0 ? rc.summary_nft_minted : creation.roles.mint === 'nobody' ? rc.summary_nft_empty_locked : rc.summary_nft_empty)
            : (supply > 0 ? rc.summary_token_minted : rc.summary_token_empty);
        const fallback = isNft
            ? (supply > 0 ? 'The collection "{name}" was created and {count} NFTs were minted into it in the same step.' : 'The collection "{name}" was created. It is empty for now: no NFT exists in it yet, they can be minted later.')
            : (supply > 0 ? 'The token "{name}" was created with an initial supply of {amount}.' : 'The token "{name}" was created. No units are in circulation yet.');
        return (tpl || fallback)
            .replace('{name}', name)
            .replace('{count}', supplyText)
            .replace('{amount}', `${supplyText}${symbol ? ` ${symbol}` : ''}`);
    })();

    const holderText = (holder: RoleHolder) => ({
        anyone: rc.holder_anyone || 'Yes, freely',
        owner: rc.holder_owner || 'Owner only',
        restricted: rc.holder_restricted || 'With special permission',
        nobody: rc.holder_nobody || 'No, nobody',
    })[holder];

    const idTypes = (rc.id_types ?? {}) as Record<string, string>;
    const mutable = new Set(creation.mutableFields);

    return (
        <section className="@container bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-2">
                <Sparkles className="size-3.5 text-[var(--color-primary)]" />
                {isNft ? (rc.title_nft || 'New NFT collection') : (rc.title_token || 'New token')}
            </h3>

            {/* ── Identity ── */}
            <div className="relative p-4 @md:p-5 bg-gradient-to-br from-[var(--color-primary)]/10 via-transparent to-[var(--color-secondary)]/10">
                <div className="flex flex-col @md:flex-row @md:items-center gap-4">
                    <div className="relative shrink-0 self-start">
                        {/* Transparent: the collection's own logo decides its colours */}
                        <div className="size-16 @md:size-20 rounded-2xl overflow-hidden bg-transparent border border-[var(--color-card-border)] grid place-items-center">
                            {iconUrl
                                ? <SafeImage src={iconUrl} alt={name} fallbackName={name} className="size-full object-contain" />
                                : <KindIcon className="size-8 text-[var(--color-primary)]" />}
                        </div>
                        <span className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md">
                            <Sparkles className="size-2.5" />
                            {rc.new_badge || 'New'}
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg @md:text-xl font-bold text-[var(--color-text-main)] break-words">{name}</span>
                            {symbol && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                    {symbol}
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]">
                                <KindIcon className="size-3" />
                                {isNft ? (rc.kind_nft || 'NFT collection') : (rc.kind_token || 'Fungible token')}
                            </span>
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
                                {creation.tags.map(tag => (
                                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[var(--color-text-muted)]">#{tag}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 @md:p-5 space-y-4 border-t border-[var(--color-card-border)]">
                {/* ── What happened, in one sentence ── */}
                <div className="flex gap-3 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3 @md:p-4">
                    <Info className="size-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
                    <p className="text-[13px] @md:text-sm leading-relaxed text-[var(--color-text-main)]">{summary}</p>
                </div>

                {/* ── Key facts ── */}
                <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-4 gap-3">
                    <FactTile
                        icon={Package}
                        label={rc.initial_supply || 'Initial supply'}
                        hint={supply > 0 ? undefined : (isNft ? (rc.supply_empty_nft || 'Empty collection') : (rc.supply_empty_token || 'No units yet'))}
                    >
                        <span className="text-xl font-black font-mono">{supplyText}</span>
                        <span className="ml-1.5 text-xs font-bold text-[var(--color-text-muted)]">{isNft ? (rc.nfts_unit || 'NFTs') : (symbol || '')}</span>
                    </FactTile>

                    {creator && (
                        <FactTile icon={UserRound} label={rc.created_by || 'Created by'}>
                            <span className="flex items-center gap-1 min-w-0">
                                <span className="font-mono text-xs truncate" title={creator}>{shortenAddress(creator)}</span>
                                <CopyButton value={creator} copiedAddress={copiedAddress} onCopy={onCopy} title={copyTitle} />
                            </span>
                        </FactTile>
                    )}

                    <FactTile
                        icon={KeyRound}
                        label={rc.controlled_by || 'Controlled by'}
                        hint={creation.ownerBadge ? (rc.controlled_by_hint || 'Whoever holds this badge manages it') : undefined}
                    >
                        {creation.ownerBadge ? (
                            <span className="flex items-center gap-2 min-w-0">
                                {badge?.iconUrl && (
                                    <SafeImage src={badge.iconUrl} alt={badge.name || ''} fallbackName={badge.name || 'Badge'} zoomable={false} className="size-6 rounded-full border border-[var(--color-card-border)] object-cover shrink-0" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => onResourceClick?.(creation.ownerBadge as string)}
                                    disabled={!onResourceClick}
                                    className="truncate text-left enabled:hover:text-[var(--color-primary)] transition-colors"
                                    title={creation.ownerBadge}
                                >
                                    {badge?.name || shortenAddress(creation.ownerBadge)}
                                </button>
                            </span>
                        ) : (
                            <span className="text-[var(--color-text-secondary)]">{rc.no_owner || 'Nobody (no owner)'}</span>
                        )}
                    </FactTile>

                    {isNft ? (
                        <FactTile icon={Fingerprint} label={rc.id_type || 'NFT identifier'}>
                            {(creation.idType && idTypes[creation.idType]) || creation.idType || '—'}
                        </FactTile>
                    ) : (
                        <FactTile icon={Fingerprint} label={rc.decimals || 'Decimals'}>
                            {creation.divisibility ?? '—'}
                        </FactTile>
                    )}
                </div>

                {/* ── What its rules allow ── */}
                <div>
                    <h4 className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                        {rc.capabilities || 'What can be done with it'}
                    </h4>
                    <ul className="grid grid-cols-1 @xl:grid-cols-2 gap-2">
                        <CapabilityRow
                            icon={Send}
                            label={rc.cap_transfer || 'Send to other accounts'}
                            holder={creation.roles.transfer}
                            text={creation.roles.transfer === 'nobody' ? (rc.transfer_nobody || 'No, soulbound') : holderText(creation.roles.transfer)}
                        />
                        <CapabilityRow
                            icon={PlusCircle}
                            label={isNft ? (rc.cap_mint_nft || 'Mint new NFTs') : (rc.cap_mint_token || 'Issue more units')}
                            holder={creation.roles.mint}
                            text={holderText(creation.roles.mint)}
                        />
                        <CapabilityRow icon={Flame} label={rc.cap_burn || 'Destroy (burn)'} holder={creation.roles.burn} text={holderText(creation.roles.burn)} />
                        <CapabilityRow icon={Undo2} label={rc.cap_recall || 'Take them back from other accounts'} holder={creation.roles.recall} text={holderText(creation.roles.recall)} />
                    </ul>
                </div>

                {/* ── Data each NFT will carry ── */}
                {isNft && creation.nftFields.length > 0 && (
                    <div>
                        <h4 className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                            {rc.nft_fields || 'Data each NFT will carry'}
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {creation.nftFields.map(field => {
                                const editable = mutable.has(field);
                                return (
                                    <span
                                        key={field}
                                        title={editable ? (rc.editable_hint || 'The owner can change this value later') : undefined}
                                        className={`flex items-center gap-1 font-mono text-[11px] px-2 py-1 rounded-md border ${editable
                                            ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                            : 'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}`}
                                    >
                                        {sanitizeText(field)}
                                        {editable && <Pencil className="size-2.5" />}
                                    </span>
                                );
                            })}
                        </div>
                        {creation.mutableFields.length > 0 && (
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                                <Pencil className="size-2.5 text-[var(--color-primary)]" />
                                {rc.editable_hint || 'The owner can change this value later'}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
