'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import { Pill } from '@/components/ui/Pill';
import { EntityBadge } from './EntityBadge';

import { ProtocolVoteCardProps } from '../types';

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
        (fields.find((f) => (f as Record<string,string>).field_name === 'protocol_version_name') as Record<string,string>)?.value ?? '',
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
    const badgeResource    = sanitizeText(proofMatch?.[2] ?? '');

    const friendlyVersion = protocolVersion.includes('cuttlefish')
        ? (tt.protocol_cuttlefish || 'Cuttlefish')
        : (protocolVersion || tt.unknown || 'Unknown');

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-accent)]/60 overflow-hidden">
            {/* Header */}
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-accent)]/40 bg-[var(--color-accent)]/12 flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                    </svg>
                    {tt.protocol_vote_label || 'Protocol Update Vote'}
                </span>
                <Pill color="green" className="text-emerald-600 dark:text-emerald-300 border-emerald-400/60 bg-emerald-400/15 font-black tracking-widest uppercase px-3">
                    {friendlyVersion}
                </Pill>
            </h3>

            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[var(--color-accent)]/30">

                {/* LEFT — Validator */}
                <div className="flex-1 p-3 bg-[var(--color-accent)]/6">
                    <h5 className="text-[10px] uppercase font-bold tracking-widest text-emerald-800 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                        <Shield className="w-3 h-3" />
                        {tt.protocol_vote_validator || 'Validator'}
                    </h5>

                    {validatorAddress
                        ? <EntityBadge address={validatorAddress} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} />
                        : <p className="text-xs text-[var(--color-text-muted)] italic py-1">{tt.protocol_vote_no_validator || 'No validator found in affected entities'}</p>
                    }

                    <div className="mt-3 flex items-center justify-between px-2.5 h-8 rounded-lg bg-[var(--color-accent)]/12 border border-[var(--color-accent)]/30">
                        <span className="text-[9px] uppercase font-bold text-emerald-700 dark:text-emerald-500 tracking-wide">
                            {tt.protocol_vote_for || 'Voting for'}
                        </span>
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 font-mono translate-y-[0.5px]">
                            {friendlyVersion}
                        </span>
                    </div>
                </div>

                {/* RIGHT — Badge presenter */}
                <div className="flex-1 p-3 bg-[var(--color-secondary)]/5">
                    <h5 className="text-[10px] uppercase font-bold tracking-widest text-indigo-800 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                        {tt.protocol_vote_presenter || 'Badge Presenter'}
                    </h5>

                    {presenterAccount
                        ? (
                            <div className="space-y-2">
                                <EntityBadge address={presenterAccount} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} />
                                {badgeResource && (
                                    <div>
                                        <span className="text-[9px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider block mb-1">
                                            {tt.protocol_vote_badge || 'Owner Badge Used'}
                                        </span>
                                        <EntityBadge address={badgeResource} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} />
                                    </div>
                                )}
                            </div>
                        )
                        : <p className="text-xs text-[var(--color-text-muted)] italic py-1">{tt.protocol_vote_no_badge || 'No badge proof found in manifest'}</p>
                    }
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-[var(--color-surface)] border-t border-[var(--color-accent)]/20 text-[10px] text-[var(--color-text-muted)] italic leading-relaxed">
                {tt.protocol_vote_desc || 'The validator owner presented their owner badge to authorise this protocol update vote on behalf of the validator node.'}
            </div>
        </div>
    );
}
