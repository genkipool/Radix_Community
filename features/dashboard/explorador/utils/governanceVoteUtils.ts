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
    options: Array<{ id: number; label: string }>;
    links: string[];
    voteCount: number | null;
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
        options: pjList(pjField(item, 'vote_options')).flatMap(opt => {
            const id = pjNumber(pjFields(pjField(opt, 'id'))[0]);
            const label = pjText(pjField(opt, 'label'));
            return id === null || !label ? [] : [{ id, label }];
        }),
        links: pjList(pjField(item, 'links')).map(pjText).filter((l): l is string => !!l && /^https?:\/\//i.test(l)),
        voteCount: pjNumber(pjField(item, 'vote_count')),
        start: pjNumber(pjField(item, 'start')),
        deadline: pjNumber(pjField(item, 'deadline')),
        quorum: fromItemOrParams('quorum'),
        approvalThreshold: fromItemOrParams('approval_threshold'),
        author: pjText(pjField(item, 'author')),
        parameterLabel: pjText(pjPath(item, 'parameter_set', 'label')),
        elevatedProposalId: pjText(pjOption(pjField(item, 'elevated_proposal_id'))),
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
