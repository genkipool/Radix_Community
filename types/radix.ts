/* ═══════ RADIX TYPES ═══════ */

export interface Validator {
    id: string;
    name: string;
    address: string;
    iconUrl?: string;
    description?: string;
    website: string;
    lsuResource: string;
    publicKey: string;
    nominalFee: number;
    externalStakeAccepted: boolean;
    registered: boolean;
    protocolUpdateVote: string;
    networkVotePercentage?: number;
    upcomingFee?: number;
    hasPendingFeeChange?: boolean;

    // Recent Uptime (14 days)
    recentProposalsMissed: number;
    recentProposalsMade: number;
    recentUptime: number;

    // Total Uptime (since Babylon)
    totalProposalsMissed: number;
    totalProposalsMade: number;
    totalUptime: number;

    // Baseline for Live Uptime calculation
    startOfLiveProposalsMade: number;
    startOfLiveProposalsMissed: number;
    serverLiveProposalsMade: number;
    serverLiveProposalsMissed: number;

    // Delegation Overview
    rank: number;
    delegators: number;
    delegatedStake: number;
    delegatedStakePercent: number;
    ownerDelegation: number;
    ownerAddress: string;
    ownerBadge?: string;
    claimTokenResourceAddress?: string;

    lsu2xrdFactor: number;
    apyProjection: number;
    effectiveFee: number;

    // Connection & Location
    /**
     * Up and validating (true), down (false) or no evidence either way (null).
     * Decided in services/nodeTelemetry: consensus first, then our node.
     */
    onlineStatus: boolean | null;
    /** What `onlineStatus` was decided from. */
    onlineReason?: OnlineReason;
    /** Its gossip port takes inbound connections; null when no address is known. */
    acceptsConnect: boolean | null;
    provider: string;
    providerPercent: number;
    country: string;
    countryPercent: number;
    countryCode: string;

    // Technical Details
    version: string;
    commit: string;

    /**
     * What our own full node observes of this validator's node, or null when
     * it knows nothing of it. When present it is the source of `acceptsConnect`,
     * `country`, `countryCode`, `version` and `commit`, and part of `onlineStatus`.
     */
    node?: ValidatorNodeTelemetry | null;

    // Epoch Performance
    epochPerformance: {
        epoch: number;
        completedProposals: number;
        missedProposals: number;
        isLive?: boolean;
    }[];

    status: 'active' | 'inactive' | 'jailed';
    tags: string[];
    totalStakeXRD: number;
    feePercent: number;
    uptimePercent: number;
    apy: number;
    ownerStake: number;
    proposalsMade: number;
    proposalsMissed: number;
}

/**
 * One validator node as seen from the peer-to-peer network by our full node.
 * Written to Redis by scripts/node-telemetry, read by services/nodeTelemetry.
 */
export interface ValidatorNodeTelemetry {
    /** ISO 3166-1 alpha-2 code of the country its IP is located in. */
    countryCode: string | null;
    /** Connected to our node within the last half hour. */
    online: boolean;
    /** Its gossip port answered (true) or not (false); null with no known address. */
    acceptsConnections: boolean | null;
    /** Node software version, when the network exposes it. */
    version: string | null;
    /** Commit the node was built from, alongside `version`. */
    commit: string | null;
    /** Unix milliseconds it was last connected; 0 when only known by address. */
    lastSeen: number;
}

/**
 * Evidence behind `Validator.onlineStatus`, strongest first:
 * - producing / missing_proposals: consensus, for active validators.
 * - connected: connected to our node.
 * - reachable / unreachable: its gossip port answered a probe, or not.
 * - no_data: nothing to go on.
 */
export type OnlineReason =
    | 'producing'
    | 'missing_proposals'
    | 'connected'
    | 'reachable'
    | 'unreachable'
    | 'no_data';

export interface NetworkStats {
    totalStaked: number;
    /** Stake delegated to validators in the active set. Absent in older caches. */
    activeStaked?: number;
    activeValidators: number;
    totalValidators: number;
    avgApy: number;
    avgUptime: number;
    epoch: number;
    stateVersion?: number;
    round?: number;
    timestamp?: string;
}

export interface TransactionInfo {
    intentHash: string;
    status: string;
    feePaid: number;
    confirmedAt: Date;
    stateVersion: number;
    message?: string;
    epoch: number;
    round: number;
    accountsCount: number;
    componentsCount: number;
    hasNfts: boolean;
    /** manifest_classes from Gateway — available without full details fetch */
    manifestClasses?: string[];
    /** All validator addresses involved in stake/unstake/claim (one per validator) */
    validatorOps?: ValidatorOp[];
    /** Custom fields for summary cards: dominant asset moved */
    displayAmount?: number;
    displayResource?: string;
    displayIsXrd?: boolean;
    displayIsMint?: boolean;
    displayResourceName?: string;
    displayResourceIcon?: string;
    /** @deprecated use validatorOps */
    validatorAddress?: string;
    /** @deprecated use validatorOps */
    stakeXrd?: number;
    /** @deprecated use validatorOps */
    unstakeXrd?: number;
    /** @deprecated use validatorOps */
    claimXrd?: number;
    /** Full balance changes if available in the summary */
    balanceChanges?: Record<string, unknown>;
    /** Perfect hydration for proposer */
    proposerInfo?: {
        validatorIndex: number;
        rank: number;
        rewardAmount: string;
        /** Pre-enriched display fields (resolved server-side from validators cache or Redis) */
        name?: string;
        iconUrl?: string;
        address?: string;
    };
}

export interface ValidatorOp {
    validatorAddress: string;
    stakeXrd?: number;
    /** Amount of LSU (Liquid Stake Units) burned during unstake */
    unstakeLsu?: number;
    /** XRD that will be claimable after unbonding period */
    unstakeXrdExpected?: number;
    claimXrd?: number;
}

export interface StakeHistoryEntry {
    date: string;
    stake: number;
    unstake: number;
    claim: number;
}
