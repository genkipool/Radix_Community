import { sanitizeText } from '@/utils/sanitize';
import type { GatewayEvent } from '@/features/dashboard/types';
import { pjField, pjFields, pjList, pjNumber, pjOption, pjPath, pjText, type PjValue } from './programmaticJson';

/* ─────────────────────────────────────────
   Ledger SBOR parsing for governance events, proposals, temperature checks,
   and Majority Judgment elections.
   ───────────────────────────────────────── */

export type GovernanceItemKind = 'proposal' | 'temperature_check' | 'election';

/** What the voter picked: option ids from a list, or a For/Against stance. */
export type VoteSelection =
    | { type: 'options'; optionIds: number[] }
    | { type: 'stance'; stance: string };

export interface VoteEventSpec {
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
    {
        event: 'MajorityJudgmentElectionVotedEvent',
        kind: 'election',
        idField: 'election_id',
        storeField: 'majority_judgment_elections',
        readSelection: data => ({
            type: 'options',
            optionIds: pjList(pjField(data, 'grades'))
                .map(g => pjNumber(pjFields(pjField(g, 'candidate_id'))[0]))
                .filter((id): id is number => id !== null),
        }),
    },
];

const GRADE_VARIANT_INDEX: Record<string, number> = {
    Poor: 0,
    Acceptable: 1,
    Good: 2,
    VeryGood: 3,
    Excellent: 4,
};

export interface GovernanceVote {
    kind: GovernanceItemKind;
    /** Governance component that recorded the vote. */
    component: string;
    itemId: string;
    voteId: string | null;
    account: string | null;
    selection: VoteSelection;
    replacingVoteId: string | null;
    /** Per-candidate Majority Judgment grades (candidate id -> 0..4), when `kind === 'election'`. */
    grades?: Record<string, number>;
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
        let grades: Record<string, number> | undefined;
        if (spec.kind === 'election') {
            const parsed: Record<string, number> = {};
            for (const g of pjList(pjField(data, 'grades'))) {
                const cid = pjNumber(pjFields(pjField(g, 'candidate_id'))[0]);
                const variant = pjField(g, 'grade')?.variant_name;
                const variantId = pjField(g, 'grade')?.variant_id;
                const val = variant && variant in GRADE_VARIANT_INDEX
                    ? GRADE_VARIANT_INDEX[variant]
                    : variantId !== undefined && Number.isInteger(Number(variantId))
                        ? Number(variantId)
                        : null;
                if (cid !== null && val !== null) parsed[String(cid)] = val;
            }
            if (Object.keys(parsed).length > 0) grades = parsed;
        }
        return [{
            kind: spec.kind,
            component,
            itemId,
            voteId: pjText(pjField(data, 'vote_id')),
            account: account ? sanitizeText(account) : null,
            selection: spec.readSelection(data),
            replacingVoteId: replacing,
            ...(grades ? { grades } : {}),
        }];
    });
}

export interface GovernanceCandidate {
    id: number;
    reference: string | null;
    displayName: string;
    description: string | null;
    links: string[];
    displayOrder: number;
}

export interface GovernanceElectionSpec {
    roleId: string | null;
    seatCount: number | null;
    candidates: GovernanceCandidate[];
    round?: 'RoundOne' | 'Rerun';
    minimumMedianGrade?: number | null;
}

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
    /** Candidate slate committed by a Temperature Check for a Majority Judgment election. */
    election?: GovernanceElectionSpec | null;
}

function parseElectionFollowUp(item: unknown): GovernanceElectionSpec | null {
    const followUp = pjField(item, 'follow_up');
    if (!followUp || followUp.variant_name !== 'MajorityJudgmentElection') return null;

    const candidates = pjList(pjField(followUp, 'candidates')).flatMap((raw, idx) => {
        const id = pjNumber(pjFields(pjField(raw, 'id'))[0]) ?? idx;
        const displayName = pjText(pjField(raw, 'display_name'))?.trim();
        if (!displayName) return [];
        const reference = pjText(pjField(raw, 'reference'))?.trim() || null;
        const description = pjText(pjField(raw, 'description'))?.trim() || null;
        const links = pjList(pjField(raw, 'links'))
            .map(pjText)
            .filter((l): l is string => !!l && /^https?:\/\//i.test(l));
        const displayOrder = pjNumber(pjField(raw, 'display_order')) ?? idx;
        return [{ id, reference, displayName, description, links, displayOrder }];
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.displayOrder - b.displayOrder);

    return {
        roleId: pjText(pjField(followUp, 'role_id'))?.trim() || null,
        seatCount: pjNumber(pjField(followUp, 'seat_count')),
        candidates,
    };
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
        election: parseElectionFollowUp(item),
    };
}

/**
 * Reads a `MajorityJudgmentElection` entry from the `majority_judgment_elections`
 * KVS and merges its active round (`rerun` or `round_one`) with the title,
 * description, links and candidate slate from its originating Temperature Check.
 */
export function parseMajorityJudgmentElection(raw: unknown, tcItem: GovernanceItem | null): GovernanceItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const tcId = pjText(pjField(raw, 'temperature_check_id'));
    const hidden = pjText(pjField(raw, 'hidden')) === 'true';
    const rerun = pjOption(pjField(raw, 'rerun'));
    const roundOne = pjOption(pjField(raw, 'round_one'));
    const activeRound = rerun ?? roundOne;
    const round: 'RoundOne' | 'Rerun' = rerun ? 'Rerun' : 'RoundOne';
    const minGradeName = activeRound ? pjField(activeRound, 'minimum_median_grade')?.variant_name : undefined;
    const minimumMedianGrade = minGradeName && minGradeName in GRADE_VARIANT_INDEX ? GRADE_VARIANT_INDEX[minGradeName] : null;
    const candidates = tcItem?.election?.candidates ?? [];

    return {
        title: tcItem?.title ?? null,
        shortDescription: tcItem?.shortDescription ?? null,
        description: tcItem?.description ?? null,
        options: candidates.map(c => ({ id: c.id, label: c.displayName })),
        links: tcItem?.links ?? [],
        voteCount: activeRound ? pjNumber(pjField(activeRound, 'vote_count')) : null,
        revoteCount: activeRound ? pjNumber(pjField(activeRound, 'revote_count')) : null,
        start: activeRound ? pjNumber(pjField(activeRound, 'start')) : null,
        deadline: activeRound ? pjNumber(pjField(activeRound, 'deadline')) : null,
        quorum: activeRound ? pjNumber(pjField(activeRound, 'quorum')) : null,
        approvalThreshold: null,
        author: tcItem?.author ?? null,
        parameterLabel: tcItem?.parameterLabel ?? null,
        elevatedProposalId: null,
        temperatureCheckId: tcId,
        maxSelections: 1,
        hidden: hidden || !activeRound,
        votersStore: activeRound ? pjText(pjField(activeRound, 'voters')) : null,
        election: tcItem?.election
            ? { ...tcItem.election, round, minimumMedianGrade }
            : null,
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
