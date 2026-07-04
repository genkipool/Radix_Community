'use client';

import React from 'react';
import { Shield, Copy, Check } from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import { Pill } from '@/components/ui/Pill';
import { EntityBadge } from './EntityBadge';

import { ProtocolVoteCardProps } from '../types/components.types';

/**
 * ProtocolVoteCard
 *
 * Shown when the transaction contains a ProtocolUpdateReadinessSignalEvent.
 * Displays the protocol version voted for, the validator that voted, and
 * the account + owner badge that authorised the vote.
 */
export function ProtocolVoteCard({
    events, affectedEntities, manifestInstructions,
    tt, onCopy, copiedAddress, onResourceClick, network,
}: ProtocolVoteCardProps) {
    const voteEvent = events.find((e) => e.name === 'ProtocolUpdateReadinessSignalEvent');
    if (!voteEvent) return null;

    /* ── Protocol version ── */
    const fields: Record<string, unknown>[] = (voteEvent?.data as Record<string, unknown>)?.fields as Record<string, unknown>[] ?? [];
    const protocolVersion = sanitizeText(
        (fields.find((f) => (f as Record<string, string>).field_name === 'protocol_version_name') as Record<string, string>)?.value ?? '',
    );

    /* ── Validator address ── */
    const validatorAddress = sanitizeText(
        affectedEntities.find((e: string) => e.startsWith('validator_')) ?? '',
    );

    /* ── Parse manifest: presenter account + badge resource ── */
    const proofNFMatch = manifestInstructions?.match(
        /Address\("(account_[a-z0-9]+)"\)\s*"create_proof_of_non_fungibles"\s*Address\("(resource_[a-z0-9]+)"\)/i,
    );
    const proofFungibleMatch = manifestInstructions?.match(
        /Address\("(account_[a-z0-9]+)"\)\s*"create_proof_of_amount"\s*Address\("(resource_[a-z0-9]+)"\)/i,
    );
    const proofMatch = proofNFMatch ?? proofFungibleMatch ?? null;

    const presenterAccount = sanitizeText(proofMatch?.[1] ?? '');
    const badgeResource = sanitizeText(proofMatch?.[2] ?? '');

    /*
     * Protocol version names are a 32-char string whose readable name is the
     * trailing alphabetic part (e.g. "220e2a4a4e86e3e6000000000anemone" →
     * "Anemone"). The raw value stays available through the title attribute.
     */
    const readableName = protocolVersion.match(/([a-z]+)$/i)?.[1] ?? '';
    const friendlyVersion = readableName.toLowerCase() === 'cuttlefish'
        ? (tt?.protocol_cuttlefish || 'Cuttlefish')
        : readableName
            ? readableName.charAt(0).toUpperCase() + readableName.slice(1).toLowerCase()
            : (protocolVersion || tt?.unknown || 'Unknown');

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-accent)]/60 overflow-hidden">
            {/* Header */}
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-accent)]/40 bg-[var(--color-accent)]/12 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                    <svg className="size-3.5 shrink-0 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span className="truncate">{tt?.protocol_vote_label || 'Protocol Update Vote'}</span>
                </span>
                <Pill color="accent" title={protocolVersion} className="font-black tracking-widest uppercase px-3 max-w-full truncate" style={{ color: 'color-mix(in srgb, var(--color-accent), var(--color-text-main) 40%)' }}>
                    {friendlyVersion}
                </Pill>
            </h3>

            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[var(--color-accent)]/30">

                {/* LEFT — Validator */}
                <div className="flex-1 p-3 bg-[var(--color-accent)]/6">
                    <h5 className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-accent)] mb-3 flex items-center gap-1.5">
                        <Shield className="size-3" />
                        {tt?.protocol_vote_validator || 'Validator'}
                    </h5>

                    {validatorAddress
                        ? <div><EntityBadge address={validatorAddress} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} /></div>
                        : <p className="text-xs text-[var(--color-text-muted)] italic py-1">{tt?.protocol_vote_no_validator || 'No validator found in affected entities'}</p>
                    }

                    <div
                        className="mt-3 flex flex-col gap-1.5 p-2.5 rounded-lg bg-[var(--color-accent)]/12 border border-[var(--color-accent)]/30"
                        title={protocolVersion}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                            <span className="text-[10px] uppercase font-black tracking-wide" style={{ color: 'color-mix(in srgb, var(--color-accent), var(--color-text-main) 40%)' }}>
                                {tt?.protocol_vote_for || 'Voting for'}
                            </span>
                            <span className="text-xs font-black font-mono break-all text-right uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--color-accent), var(--color-text-main) 40%)' }}>
                                {friendlyVersion}
                            </span>
                        </div>
                        {protocolVersion && protocolVersion.toLowerCase() !== friendlyVersion.toLowerCase() && (
                            <div className="flex items-start justify-between gap-2 border-t border-[var(--color-accent)]/40 pt-1.5 mt-0.5">
                                <span className="text-[11px] font-black font-mono break-all" style={{ color: 'color-mix(in srgb, var(--color-accent), var(--color-text-main) 40%)' }}>
                                    {protocolVersion}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onCopy(protocolVersion); }}
                                    className={`shrink-0 p-1 -m-1 rounded transition-colors ${copiedAddress === protocolVersion
                                        ? 'text-green-500'
                                        : 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
                                        }`}
                                    title="Copy hash"
                                >
                                    {copiedAddress === protocolVersion
                                        ? <Check className="size-3.5" />
                                        : <Copy className="size-3.5" />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT — Badge presenter */}
                <div className="flex-1 p-3 bg-[var(--color-secondary)]/5">
                    <h5 className="text-[10px] uppercase font-bold tracking-widest text-indigo-800 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                        {tt?.protocol_vote_presenter || 'Badge Presenter'}
                    </h5>

                    {presenterAccount
                        ? (
                            <div className="space-y-2">
                                <EntityBadge address={presenterAccount} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} />
                                {badgeResource && (
                                    <div>
                                        <span className="text-[9px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider block mb-1">
                                            {tt?.protocol_vote_badge || 'Owner Badge Used'}
                                        </span>
                                        <EntityBadge address={badgeResource} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} />
                                    </div>
                                )}
                            </div>
                        )
                        : <p className="text-xs text-[var(--color-text-muted)] italic py-1">{tt?.protocol_vote_no_badge || 'No badge proof found in manifest'}</p>
                    }
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-[var(--color-surface)] border-t border-[var(--color-accent)]/20 text-[10px] text-[var(--color-text-muted)] italic leading-relaxed">
                {tt?.protocol_vote_desc || 'The validator owner presented their owner badge to authorise this protocol update vote on behalf of the validator node.'}
            </div>
        </div>
    );
}
