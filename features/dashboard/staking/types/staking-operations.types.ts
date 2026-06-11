export type StakingTab = 'delegator' | 'validator';
export type StakingAction = 'Stake' | 'Unstake' | 'Claim';

export interface StakingPopupState {
    isOpen: boolean;
    activeTab: StakingTab;
    selectedAccountAddresses: string[];
    amount: string;
}

export interface AccountStakingData {
    /** Available XRD balance to stake */
    xrdBalance: number;
    /** Current staked balance (amount of LSU owned) */
    lsuBalance: number;
    /** Current unstaking balance (XRD in unlocking period) */
    pendingUnstake: number;
    /** Current claimable XRD balance */
    claimableXrd: number;
    /** Local IDs for the standard claim NFTs */
    claimNftIds: string[];
    /** Local IDs for the owner claim NFTs (if validator tab is active) */
    ownerClaimNftIds: string[];
    /** Tooltip with epoch unlock info for pending unstake */
    unstakeTooltip: string;
    /** Whether this account is the owner of the currently viewed validator */
    isOwner: boolean;
    /** Current owner staked balance in XRD */
    ownerLockedStakeXrd: number;
    /** Current owner unstaking balance in XRD */
    ownerPendingUnlockXrd: number;
    /** Current owner claimable balance in LSU */
    ownerUnlockedLsu: number;
    /** Current owner claimable balance in XRD */
    ownerUnlockedXrd: number;
}
