import type { GovernanceItem, GovernanceItemKind } from '../lib/governanceVotes';

/** A proposal or temperature check together with the system that holds it. */
export interface GovernanceEntry {
    systemKey: string;
    systemName: string;
    kind: GovernanceItemKind;
    id: string;
    item: GovernanceItem;
}

/** Per-candidate Majority Judgment result published by the vote collector. */
export interface MajorityJudgmentCandidateResult {
    candidateId: number;
    /** Voting power per grade: index 0 = Poor .. 4 = Excellent. */
    histogram: [string, string, string, string, string];
    qualifyingGrade: number;
    powerAbove: string;
    powerBelow: string;
    p: string;
    q: string;
    band: string;
    electable: boolean;
    rank: number;
    tieGroupId: number;
    outcome: string;
}

/** Candidate-list Temperature Check approval summary attached to an election. */
export interface MajorityJudgmentTcResult {
    forVotingPower: string;
    againstVotingPower: string;
    participationXrd: string;
    quorumXrd: string;
    quorumMet: boolean;
    approvalThreshold: string;
    forShare: string;
    approvalMet: boolean;
    passed: boolean;
    recordedAt: string | null;
}

/** Full live/final Majority Judgment election tally from the vote collector. */
export interface MajorityJudgmentElectionData {
    status: string;
    round: 'RoundOne' | 'Rerun';
    provisional: boolean;
    totalVotingPower: string;
    quorumXrd: string;
    quorumMet: boolean;
    minimumMedianGrade: number;
    gradeQuantileApplied: string;
    reserveListDays: number | null;
    parameterSetId: string | null;
    parameterSetVersion: number | null;
    tcVotingStart: string | null;
    tcVotingEnd: string | null;
    temperatureCheckResult: MajorityJudgmentTcResult | null;
    candidateResults: MajorityJudgmentCandidateResult[];
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
    /** Per-candidate Majority Judgment grades (candidate id -> 0..4), for elections. */
    grades?: Record<string, number>;
}
