'use client';

import React from 'react';
import { Wallet, CheckCircle2, Circle, Square, CheckSquare } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { itemChoices } from '../lib/governanceVotes';
import { useCastVote } from '../hooks/useCastVote';
import { fill } from '../lib/format';
import { TONE, type Gv } from './VoteParts';
import { VoteAccess, VoteSubmit } from './VoteControls';
import type { G } from './GovernanceBadges';

/**
 * Side panel of the Proposal tab: pick the account and the option(s), sign in
 * the Radix Wallet. The Result tab votes from its own results box instead.
 */
export function VotePanel({ entry, system, g, language, now }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    g: G;
    language: string;
    now: number;
}) {
    const gv: Gv = g.vote ?? {};
    const stances = (gv.stances ?? {}) as Record<string, string>;
    const stanceLabel = (s: string) => stances[s] || s;
    const vote = useCastVote(entry, system, now, stanceLabel);
    const choices = itemChoices(entry.kind, entry.item, stanceLabel);

    return (
        <section aria-labelledby="vote-panel-title" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] overflow-hidden">
            <h2 id="vote-panel-title" className="px-5 py-4 flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)] border-b border-[var(--color-card-border)] bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10">
                <Wallet className="size-4 text-[var(--color-primary)]" />
                {g.vote_title || 'Your vote'}
            </h2>

            <div className="p-5 space-y-4">
                <VoteAccess vote={vote} item={entry.item} g={g} language={language} now={now} />

                {vote.canVote && (
                    <fieldset>
                        <legend className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                            {vote.maxPick === 1 ? (g.choose_one || 'Pick one option') : fill(g.choose_up_to || 'Pick up to {n} options', { n: String(vote.maxPick) })}
                        </legend>
                        <div className="space-y-2">
                            {choices.map(c => {
                                const on = vote.picked.includes(c.key);
                                const Icon = vote.maxPick === 1 ? (on ? CheckCircle2 : Circle) : (on ? CheckSquare : Square);
                                return (
                                    <button
                                        key={c.key}
                                        type="button"
                                        role={vote.maxPick === 1 ? 'radio' : 'checkbox'}
                                        aria-checked={on}
                                        onClick={() => vote.toggle(c.key)}
                                        className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${on
                                            ? `${TONE[c.tone].soft} ${TONE[c.tone].text}`
                                            : 'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-main)] hover:border-[var(--color-primary)]/40'}`}
                                    >
                                        <Icon className="size-5 shrink-0" />
                                        <span className="break-words">{c.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                )}

                <VoteSubmit vote={vote} item={entry.item} g={g} language={language} />
            </div>
        </section>
    );
}
