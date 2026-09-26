import type { GovernanceItem, GovernanceItemKind } from '../lib/governanceVotes';

/** A proposal or temperature check together with the system that holds it. */
export interface GovernanceEntry {
    systemKey: string;
    systemName: string;
    kind: GovernanceItemKind;
    id: string;
    item: GovernanceItem;
}

/** A voter's current vote: ledger record joined with the collector's voting power. */
export interface VoterRow {
    account: string;
    /** Ballot keys picked: option ids ("0") or a stance ("For"). */
    choices: string[];
    /** Voting power in XRD, or null when the collector has not counted it (yet). */
    votePower: string | null;
    txid: string;
    /** ISO timestamp. */
    time: string;
    /** Increases with every vote on the item: higher is more recent. */
    voteId: number;
    /** Times the account changed its vote. */
    changes: number;
}
