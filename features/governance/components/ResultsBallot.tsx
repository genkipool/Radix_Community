'use client';

import React from 'react';
import { CheckCircle2, Circle, Square, CheckSquare, Vote } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { selectionKeys, type BallotChoice, type TallySummary } from '../lib/governanceVotes';
import { useCastVote } from '../hooks/useCastVote';
import { fill, formatPct, formatXrd } from '../lib/format';
import { TONE, type Gv } from './VoteParts';
import { VoteAccess, VoteSubmit } from './VoteControls';
import type { G } from './GovernanceBadges';

/**
 * The results box of the Result tab, which is also the ballot: every option
 * with the voting power behind it and, while voting is open, a click away
 * from being chosen. The account and the send button sit right below.
 */
export function ResultsBallot({ entry, system, choices, tally, g, language, now }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    choices: BallotChoice[];
    tally: TallySummary | null;
    g: G;
    language: string;
    now: number;
}) {
    const gv: Gv = g.vote ?? {};
    const stances = (gv.stances ?? {}) as Record<string, string>;
    const vote = useCastVote(entry, system, now, s => stances[s] || s);
    const currentKeys = new Set(vote.current.flatMap(c => (c.selection ? selectionKeys(c.selection) : [])));
    const rows = tally?.rows ?? choices.map(c => ({ ...c, power: 0, share: 0 }));

    return (
        <section aria-labelledby="results-ballot" className="h-full flex flex-col gap-4 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="results-ballot" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Vote className="size-4 text-[var(--color-primary)]" />{gv.results || 'Results'}
                </h3>
                {vote.canVote && (
                    <span className="text-xs font-semibold text-[var(--color-primary)]">
                        {vote.maxPick === 1 ? (g.choose_one || 'Pick one option') : fill(g.choose_up_to || 'Pick up to {n} options', { n: String(vote.maxPick) })}
                    </span>
                )}
            </div>

            <div role={vote.canVote ? (vote.maxPick === 1 ? 'radiogroup' : 'group') : undefined} aria-labelledby="results-ballot" className="space-y-2">
                {rows.map(r => {
                    const picked = vote.picked.includes(r.key);
                    const mine = currentKeys.has(r.key);
                    const Icon = vote.maxPick === 1 ? (picked ? CheckCircle2 : Circle) : (picked ? CheckSquare : Square);
                    const body = (
                        <>
                            <div className="flex items-center justify-between gap-3 text-[13px]">
                                <span className={`flex items-center gap-2 min-w-0 ${picked ? `${TONE[r.tone].text} font-bold` : 'text-[var(--color-text-main)] font-semibold'}`}>
                                    {vote.canVote && <Icon className="size-4 shrink-0" />}
                                    <span className="break-words">{r.label}</span>
                                    {mine && (
                                        <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-[var(--color-accent)]/40 text-[var(--color-accent)] shrink-0">
                                            {g.your_current_vote || 'Your vote'}
                                        </span>
                                    )}
                                </span>
                                {tally && (
                                    <span className="flex items-baseline gap-2 shrink-0 font-mono">
                                        <span className="text-xs text-[var(--color-text-muted)]">{formatXrd(r.power, language)} XRD</span>
                                        <span className="text-sm font-black text-[var(--color-text-main)] w-14 text-right">{formatPct(r.share, language)}</span>
                                    </span>
                                )}
                            </div>
                            {tally && (
                                <div className="mt-2 h-2 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                    <div className={`h-full rounded-full transition-[width] duration-500 ${TONE[r.tone].bar}`} style={{ width: `${r.share * 100}%` }} />
                                </div>
                            )}
                        </>
                    );
                    const box = `block w-full text-left rounded-xl border px-3.5 py-3 transition-colors ${picked
                        ? TONE[r.tone].soft
                        : 'border-[var(--color-card-border)] bg-[var(--color-surface)]'}`;
                    return vote.canVote ? (
                        <button
                            key={r.key}
                            type="button"
                            role={vote.maxPick === 1 ? 'radio' : 'checkbox'}
                            aria-checked={picked}
                            onClick={() => vote.toggle(r.key)}
                            className={`${box} ${picked ? '' : 'hover:border-[var(--color-primary)]/50'} cursor-pointer`}
                        >
                            {body}
                        </button>
                    ) : (
                        <div key={r.key} className={box}>{body}</div>
                    );
                })}
            </div>

            {/* Pushed to the bottom so both boxes of the row end level. */}
            <div className="mt-auto pt-4 border-t border-[var(--color-card-border)] space-y-3">
                <VoteAccess vote={vote} item={entry.item} g={g} language={language} now={now} compact />
                <VoteSubmit vote={vote} item={entry.item} g={g} language={language} />
            </div>
        </section>
    );
}
