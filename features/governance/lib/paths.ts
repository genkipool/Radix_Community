import type { GovernanceItemKind } from './governanceVotes';

/** URL segment for each kind of governance item. */
export const KIND_SEGMENT: Record<GovernanceItemKind, string> = {
    proposal: 'proposal',
    temperature_check: 'temperature-check',
};

export const kindFromSegment = (segment: string): GovernanceItemKind | null =>
    (Object.keys(KIND_SEGMENT) as GovernanceItemKind[]).find(k => KIND_SEGMENT[k] === segment) ?? null;

/** Path (without locale) of an item's page in the governance section. */
export const governanceItemPath = (systemKey: string, kind: GovernanceItemKind, id: string) =>
    `/governance/${systemKey}/${KIND_SEGMENT[kind]}/${id}`;
