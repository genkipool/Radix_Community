import { pjField, pjFields, pjList, pjNumber } from './programmaticJson';
import type { GovernanceItem, GovernanceItemKind, GovernanceVote, VoteSelection } from './governanceSbor';

export {
    VOTE_EVENT_SPECS,
    extractGovernanceVotes,
    findStoreAddress,
    parseGovernanceItem,
    parseMajorityJudgmentElection,
    specFor,
    type GovernanceCandidate,
    type GovernanceElectionSpec,
    type GovernanceItem,
    type GovernanceItemKind,
    type GovernanceVote,
    type VoteEventSpec,
    type VoteSelection,
} from './governanceSbor';

/** Window during which a missing collector votePower is treated as still indexing. */
export const FRESH_VOTE_WINDOW_MS = 10 * 60_000;

/* ─────────────────────────────────────────
   Presentation helpers
   ───────────────────────────────────────── */

export type VoteTone = 'positive' | 'negative' | 'neutral';

const POSITIVE = /^(for|yes|approve|accept|aye|s[ií]|a favor)\b/i;
const NEGATIVE = /^(against|no|reject|deny|nay|en contra)\b/i;

export function toneOf(label: string): VoteTone {
    if (POSITIVE.test(label.trim())) return 'positive';
    if (NEGATIVE.test(label.trim())) return 'negative';
    return 'neutral';
}

/** Labels of the chosen options, falling back to "#id" when the item is unknown. */
export function selectedLabels(selection: VoteSelection, item: GovernanceItem | null): string[] {
    if (selection.type === 'stance') return selection.stance ? [selection.stance] : [];
    return selection.optionIds.map(id => item?.options.find(o => o.id === id)?.label ?? `#${id}`);
}

export type VotingPhase = 'upcoming' | 'open' | 'closed' | 'unknown';

export function votingPhase(item: GovernanceItem | null, nowSec = Date.now() / 1000): VotingPhase {
    if (!item?.deadline) return 'unknown';
    if (item.start && nowSec < item.start) return 'upcoming';
    return nowSec < item.deadline ? 'open' : 'closed';
}

/** Share of the voting window already elapsed, 0..1. */
export function votingProgress(item: GovernanceItem | null, nowSec = Date.now() / 1000): number | null {
    if (!item?.start || !item.deadline || item.deadline <= item.start) return null;
    return Math.min(1, Math.max(0, (nowSec - item.start) / (item.deadline - item.start)));
}

/* ─────────────────────────────────────────
   Ballot and weighted result
   ───────────────────────────────────────── */

const STANCES = ['For', 'Against'];

export interface BallotChoice {
    /** Key the vote collector uses for this choice: option id or stance. */
    key: string;
    label: string;
    selected: boolean;
    tone: VoteTone;
}

/** Every choice an item's ballot offers, none selected. */
export function itemChoices(kind: GovernanceItemKind, item: GovernanceItem | null, stanceLabel: (s: string) => string = s => s): BallotChoice[] {
    if (kind === 'temperature_check') {
        return STANCES.map(key => ({ key, label: stanceLabel(key), selected: false, tone: toneOf(key) }));
    }
    // The tone (for / against / neutral) is read from the ledger's own label, whatever language is shown.
    return (item?.options ?? []).map(o => ({ key: String(o.id), label: o.label, selected: false, tone: toneOf(o.sourceLabel ?? o.label) }));
}

/** Collector / ballot key of each choice in a selection. */
export function selectionKeys(selection: VoteSelection): string[] {
    return selection.type === 'stance' ? (selection.stance ? [selection.stance] : []) : selection.optionIds.map(String);
}

/** Every choice the ballot offered, with the one(s) this vote picked marked. */
export function ballotChoices(vote: GovernanceVote, item: GovernanceItem | null, stanceLabel: (s: string) => string = s => s): BallotChoice[] {
    const picked = new Set(selectionKeys(vote.selection));
    const choices = itemChoices(vote.kind, item, stanceLabel);
    // Keep choices the ballot does not list (unknown stance, option of an unreadable item).
    const extra = [...picked]
        .filter(key => !choices.some(c => c.key === key))
        .map(key => ({ key, label: vote.selection.type === 'stance' ? stanceLabel(key) : `#${key}`, selected: false, tone: toneOf(key) }));
    return [...choices, ...extra].map(c => ({ ...c, selected: picked.has(c.key) }));
}

export interface VoteTallyInput {
    results: Array<{ vote: string; votePower: string }>;
    accountPower: string | null;
}

export type VoteOutcome = 'approved' | 'rejected' | 'no_quorum';

export interface TallyRow extends BallotChoice {
    /** Voting power behind this choice, in XRD. */
    power: number;
    /** Share of all the voting power cast, 0..1. */
    share: number;
}

export interface TallySummary {
    rows: TallyRow[];
    /** Voting power that took part, in XRD. */
    turnout: number;
    /** Turnout relative to the quorum (1 = exactly the quorum). */
    quorumRatio: number | null;
    quorumMet: boolean | null;
    /** Share in favour among the votes that take a side (abstentions left out). */
    approvalShare: number | null;
    /** Result by the item's own rules; provisional while voting is open. */
    outcome: VoteOutcome | null;
    accountPower: number | null;
    accountShare: number | null;
}

const toPower = (v: string | null | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Weighs the ballot with the collector's tally and applies the item's rules:
 * enough voting power must take part (quorum) and the share in favour among
 * decisive votes must reach the approval threshold.
 */
export function summarizeTally(choices: BallotChoice[], tally: VoteTallyInput, item: GovernanceItem | null): TallySummary {
    const powerOf = new Map(tally.results.map(r => [r.vote, toPower(r.votePower)]));
    const extra: BallotChoice[] = tally.results
        .filter(r => !choices.some(c => c.key === r.vote))
        .map(r => ({ key: r.vote, label: r.vote, selected: false, tone: toneOf(r.vote) }));
    const all = [...choices, ...extra];
    const turnout = all.reduce((sum, c) => sum + (powerOf.get(c.key) ?? 0), 0);
    const rows = all.map(c => {
        const power = powerOf.get(c.key) ?? 0;
        return { ...c, power, share: turnout > 0 ? power / turnout : 0 };
    });

    const inFavour = rows.filter(r => r.tone === 'positive').reduce((s, r) => s + r.power, 0);
    const against = rows.filter(r => r.tone === 'negative').reduce((s, r) => s + r.power, 0);
    const hasSides = rows.some(r => r.tone === 'positive');
    const approvalShare = hasSides && inFavour + against > 0 ? inFavour / (inFavour + against) : hasSides ? 0 : null;

    const quorumRatio = item?.quorum ? turnout / item.quorum : null;
    const quorumMet = quorumRatio === null ? null : quorumRatio >= 1;
    const threshold = item?.approvalThreshold ?? null;
    const outcome: VoteOutcome | null = quorumMet === false
        ? 'no_quorum'
        : quorumMet && approvalShare !== null && threshold !== null
            ? (approvalShare >= threshold ? 'approved' : 'rejected')
            : null;

    const accountPower = tally.accountPower === null ? null : toPower(tally.accountPower);
    return {
        rows,
        turnout,
        quorumRatio,
        quorumMet,
        approvalShare,
        outcome,
        accountPower,
        accountShare: accountPower !== null && turnout > 0 ? accountPower / turnout : null,
    };
}

/**
 * Accounts that voted. `vote_count` numbers every vote record, including the
 * ones that replaced an earlier vote of the same account.
 */
export function uniqueVoters(item: GovernanceItem | null): number | null {
    if (item?.voteCount == null) return null;
    return Math.max(0, item.voteCount - (item.revoteCount ?? 0));
}

/**
 * Reconciles SSR-cached voter / revote counts with live voter rows when
 * available so KPI cards, detail rows, and tables never lag behind each other.
 */
export function resolveLiveVoterCounts(
    item: GovernanceItem | null,
    liveVoters: ReadonlyArray<{ changes: number }> | null | undefined,
): { voters: number | null; revotes: number } {
    const ssrVoters = uniqueVoters(item);
    const voters = liveVoters != null ? Math.max(ssrVoters ?? 0, liveVoters.length) : ssrVoters;
    const liveRevotes = liveVoters != null ? liveVoters.reduce((sum, v) => sum + v.changes, 0) : null;
    const revotes = liveRevotes != null ? Math.max(item?.revoteCount ?? 0, liveRevotes) : (item?.revoteCount ?? 0);
    return { voters, revotes };
}

/** A voter's current vote as stored in the item's `voters` key-value store. */
export function parseVoterEntry(entry: unknown, kind: GovernanceItemKind): VoteSelection | null {
    if (!entry || typeof entry !== 'object') return null;
    if (kind === 'temperature_check') {
        const stance = pjField(entry, 'vote')?.variant_name;
        return stance ? { type: 'stance', stance } : null;
    }
    const optionIds = pjList(pjField(entry, 'options'))
        .map(opt => pjNumber(pjFields(opt)[0]))
        .filter((id): id is number => id !== null);
    return optionIds.length ? { type: 'options', optionIds } : null;
}
