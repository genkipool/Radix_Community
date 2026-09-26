import type { GovernanceItem, GovernanceItemKind } from '../lib/governanceVotes';

/** A proposal or temperature check together with the system that holds it. */
export interface GovernanceEntry {
    systemKey: string;
    systemName: string;
    kind: GovernanceItemKind;
    id: string;
    item: GovernanceItem;
}
