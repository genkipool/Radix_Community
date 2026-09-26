import { sanitizeText } from '@/utils/sanitize';
import type { GatewayEvent } from '@/features/dashboard/types';
import { pjField, pjFields, pjList, pjNumber, pjOption, pjPath, pjText, type PjValue } from './programmaticJson';

/* ─────────────────────────────────────────
   Vote events
   Each governance blueprint emits its own "voted" event. Supporting a new one
   (e.g. an election) only takes one more entry in VOTE_EVENT_SPECS.
   ───────────────────────────────────────── */

export type GovernanceItemKind = 'proposal' | 'temperature_check';

/** What the voter picked: option ids from a list, or a For/Against stance. */
export type VoteSelection =
    | { type: 'options'; optionIds: number[] }
    | { type: 'stance'; stance: string };

interface VoteEventSpec {
    event: string;
    kind: GovernanceItemKind;
    /** Event field holding the id of the item voted on. */
    idField: string;
    /** Component state field holding the key-value store of those items. */
    storeField: string;
    readSelection: (data: PjValue) => VoteSelection;
}

export const VOTE_EVENT_SPECS: readonly VoteEventSpec[] = [
    {
        event: 'ProposalVotedEvent',
        kind: 'proposal',
        idField: 'proposal_id',
        storeField: 'proposals',
        readSelection: data => ({
            type: 'options',
            optionIds: pjList(pjField(data, 'options'))
                .map(opt => pjNumber(pjFields(opt)[0]))
                .filter((id): id is number => id !== null),
        }),
    },
    {
        event: 'TemperatureCheckVotedEvent',
        kind: 'temperature_check',
        idField: 'temperature_check_id',
        storeField: 'temperature_checks',
        readSelection: data => ({ type: 'stance', stance: pjField(data, 'vote')?.variant_name ?? '' }),
    },
];

export interface GovernanceVote {
    kind: GovernanceItemKind;
    /** Governance component that recorded the vote. */
    component: string;
    itemId: string;
    voteId: string | null;
    account: string | null;
    selection: VoteSelection;
    replacingVoteId: string | null;
}

export function extractGovernanceVotes(events: GatewayEvent[] = []): GovernanceVote[] {
    return events.flatMap(ev => {
        const spec = VOTE_EVENT_SPECS.find(s => s.event === ev.name);
        const component = sanitizeText(ev.emitter?.entity?.entity_address || '');
        const data = ev.data as PjValue | undefined;
        const itemId = pjText(pjField(data, spec?.idField ?? ''));
        if (!spec || !data || !component || itemId === null) return [];
        const account = pjText(pjField(data, 'account'));
        const replacing = pjText(pjOption(pjField(data, 'replacing_vote_id')));
        return [{
            kind: spec.kind,
            component,
            itemId,
            voteId: pjText(pjField(data, 'vote_id')),
            account: account ? sanitizeText(account) : null,
            selection: spec.readSelection(data),
            replacingVoteId: replacing,
        }];
    });
}

/* ─────────────────────────────────────────
   Voted item (proposal / temperature check)
   ───────────────────────────────────────── */

export interface GovernanceItem {
    title: string | null;
    shortDescription: string | null;
    /** Full text, in Markdown. */
    description: string | null;
    /** `sourceLabel` keeps the ledger's label when `label` is shown translated. */
    options: Array<{ id: number; label: string; sourceLabel?: string }>;
    links: string[];
    voteCount: number | null;
    /** Votes that replaced an earlier vote of the same account. */
    revoteCount: number | null;
    /** Unix seconds. */
    start: number | null;
    deadline: number | null;
    /** Minimum voting power that has to take part, in XRD. */
    quorum: number | null;
    /** Share of the votes an option needs to pass, 0..1. */
    approvalThreshold: number | null;
    author: string | null;
    parameterLabel: string | null;
    /** Proposal a temperature check was promoted to, once it passed. */
    elevatedProposalId: string | null;
    /** Temperature check a proposal came from. */
    temperatureCheckId: string | null;
    /** How many options a voter may pick; 1 for a single-choice ballot. */
    maxSelections: number;
    /** Hidden by the system's operator (spam, withdrawn…). */
    hidden: boolean;
    /** Key-value store mapping each voter account to its current vote. */
    votersStore: string | null;
}

/**
 * Reads a governance item stored by either governance blueprint. Thresholds
 * live on the item itself, or under its parameter set snapshot keyed by kind.
 */
export function parseGovernanceItem(item: unknown, kind: GovernanceItemKind): GovernanceItem | null {
    if (!item || typeof item !== 'object') return null;
    const params = pjPath(item, 'parameter_set', 'parameters', kind);
    const fromItemOrParams = (name: string) => pjNumber(pjField(item, name)) ?? pjNumber(pjField(params, name));

    return {
        title: pjText(pjField(item, 'title')),
        shortDescription: pjText(pjField(item, 'short_description')),
        description: pjText(pjField(item, 'description')),
        options: pjList(pjField(item, 'vote_options')).flatMap(opt => {
            const id = pjNumber(pjFields(pjField(opt, 'id'))[0]);
            const label = pjText(pjField(opt, 'label'));
            return id === null || !label ? [] : [{ id, label }];
        }),
        links: pjList(pjField(item, 'links')).map(pjText).filter((l): l is string => !!l && /^https?:\/\//i.test(l)),
        voteCount: pjNumber(pjField(item, 'vote_count')),
        revoteCount: pjNumber(pjField(item, 'revote_count')),
        start: pjNumber(pjField(item, 'start')),
        deadline: pjNumber(pjField(item, 'deadline')),
        quorum: fromItemOrParams('quorum'),
        approvalThreshold: fromItemOrParams('approval_threshold'),
        author: pjText(pjField(item, 'author')),
        parameterLabel: pjText(pjPath(item, 'parameter_set', 'label')),
        elevatedProposalId: pjText(pjOption(pjField(item, 'elevated_proposal_id'))),
        temperatureCheckId: pjText(pjField(item, 'temperature_check_id')),
        maxSelections: pjNumber(pjOption(pjField(item, 'max_selections'))) ?? 1,
        hidden: pjText(pjField(item, 'hidden')) === 'true',
        votersStore: pjText(pjField(item, 'voters')),
    };
}

/** Address of the key-value store named `field` in a component's state. */
export function findStoreAddress(componentState: unknown, field: string): string | null {
    const addr = pjText(pjField(componentState, field));
    return addr && addr.startsWith('internal_keyvaluestore_') ? addr : null;
}

export function specFor(kind: GovernanceItemKind): VoteEventSpec {
    return VOTE_EVENT_SPECS.find(s => s.kind === kind) as VoteEventSpec;
}

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
