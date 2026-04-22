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
    lsu2xrdFactor: number;
    apyProjection: number;
    effectiveFee: number;

    // Connection & Location
    onlineStatus: boolean;
    acceptsConnect: boolean;
    provider: string;
    providerPercent: number;
    country: string;
    countryPercent: number;
    countryCode: string;

    // Technical Details
    version: string;
    commit: string;

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

export interface NetworkStats {
    totalStaked: number;
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
