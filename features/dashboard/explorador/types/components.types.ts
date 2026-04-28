import React from 'react';
import type {
    Network,
    GatewayEntityDetails,
    TranslationsT,
    TransactionDetails,
    MarketData
} from '@/features/dashboard/types';
import type {
    TransactionInfo,
    Validator,
    ValidatorOp
} from '@/types/radix';



import type {
    FungibleChange,
    BalanceChanges,
    NonFungibleChange
} from './gateway.types';



export type {
    TransactionInfo,
    Validator,
    ValidatorOp
};


export interface AccountRewardsCsvModalDict {
    download_account_rewards?: string;
    account_rewards_modal_title?: string;
    account_rewards_modal_desc?: string;
    account_rewards_modal_download?: string;
    account_rewards_modal_no_data?: string;
    account_rewards_modal_error?: string;
    account_rewards_modal_loading?: string;
    account_rewards_modal_generating?: string;
    account_rewards_modal_generating_desc?: string;
    account_rewards_modal_close?: string;
    account_rewards_summary_title?: string;
    account_rewards_summary_total?: string;
    account_rewards_summary_fiat?: string;
    account_rewards_summary_dream?: string;
}

export interface AssetTransferGroupProps {
    group: FungibleChange[];
    balanceChanges: BalanceChanges;
    initiators: Set<string>;
    realTransferAddresses: Set<string>;
    actualFeePaid: string;
    tt?: TranslationsT['dashboard']['transactions'];
    t?: TranslationsT;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    formatEntity: (e: string) => string;
    readingMode?: boolean;
    network: Network;
    isClaim?: boolean;
    isUnstake?: boolean;
    isStake?: boolean;
    validatorOps?: ValidatorOp[];
    /** For unstake: the validatorOp paired with this LSU group */
    pairedValidatorOp?: ValidatorOp;
    /** For unstake: the NFT change (added) paired with this LSU group */
    pairedNftChange?: NonFungibleChange;
    columns: number;
    locale: string;
    marketData?: MarketData | null;
}

export interface TransferFooterProps {
    senders: FungibleChange[];
    receivers: FungibleChange[];
    actualFeePaid: string;
    tt: TranslationsT['dashboard']['transactions'];
    resourceAddress?: string;
    isResourceBurned?: boolean;
    mintedNftCount?: number;
    burnedNftCount?: number;
    network?: Network;
    locale: string;
}

export interface TransactionCardProps {
    tx: TransactionInfo;
    index: number;
    isExpanded: boolean;
    columns: number;
    onExpand: (intentHash: string) => void;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    t?: TranslationsT;
    readingMode?: boolean;
    network?: Network;
    timezone: string;
    locale: string;
    marketData?: MarketData | null;
}

export interface TransactionDetailModalProps {
    tx: TransactionInfo;
    onClose: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    t?: TranslationsT;
    dt?: TranslationsT['dashboard'];
    copiedAddress: string | null;
    copyAddress: (addr: string) => void;
    network: Network;
    prevTxHash?: string;
    nextTxHash?: string;
    direction?: number;
    setDirection?: React.Dispatch<React.SetStateAction<number>>;
    timezone: string;
    locale: string;
    marketData?: MarketData | null;
}

export interface TransactionTabsProps {
    details?: TransactionDetails | null;
    tx: TransactionInfo;
    t?: TranslationsT | null;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    formatEntity: (e: string) => string;
    readingMode?: boolean;
    network: Network;
    columns: number;
    timezone: string;
    locale: string;
    marketData?: MarketData | null;
}

export interface AccountCardProps {
    address: string;
    columns: number;
    isExpanded: boolean;
    onExpand?: (id: string) => void;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    t?: TranslationsT;
    network: Network;
    locale: string;
    marketData?: MarketData | null;
    readingMode?: boolean;
    isModal?: boolean;
}

export interface ValidatorInlinePanelProps {
    validatorAddress: string;
    isStake: boolean;
    isUnstake: boolean;
    isClaim: boolean;
    stakeXrd?: number;
    unstakeLsu?: number;
    unstakeXrdExpected?: number;
    /** @deprecated kept for legacy fallback */
    unstakeXrd?: number;
    claimXrd?: number;
    tt: TranslationsT['dashboard']['transactions'];
    dt?: TranslationsT['dashboard'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: Network;
    rightLabel?: string;
    rightContent?: React.ReactNode;
    locale: string;
}

export interface UnstakeAssetCardProps {
    senderAddr: string;
    allLsuChanges: FungibleChange[];
    totalLsu: number;
    fmtNum: (n: number) => string;
    nftAdded: NonFungibleChange[];
    validatorOps: ValidatorOp[];
    actualFeePaid: string;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    formatEntity: (e: string) => string;
    readingMode?: boolean;
    network: Network;
    columns: number;
    locale: string;
    marketData?: MarketData | null;
}

export interface ProtocolVoteCardProps {
    events: Array<Record<string, unknown>>;
    affectedEntities: string[];
    manifestInstructions: string;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
}

export interface EntitiesSectionProps {
    /** 'created' shows cyan/Zap; 'affected' shows violet/Activity */
    variant: 'created' | 'affected';
    details: TransactionDetails;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
    marketData?: MarketData | null;
}

export interface TransactionDetailsTabProps {
    details: TransactionDetails;
    tx: TransactionInfo;
    tt: TranslationsT['dashboard']['transactions'];
    te: Record<string, string>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    formatEntity: (e: string) => string;
    network: Network;
    timezone: string;
    locale: string;
}

export interface FeesDistributionSectionProps {
    details: TransactionDetails;
    tx: TransactionInfo;
    readingMode?: boolean;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    columns: number;
    locale: string;
}

export interface BalanceChangeRowProps {
    change: FungibleChange;
    t?: TranslationsT;
    tt?: TranslationsT['dashboard']['transactions'];
    onResourceClick?: (addr: string) => void;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    readingMode?: boolean;
    network?: Network;
    side?: 'sender' | 'receiver';
    locale: string;
    iconOverride?: React.ReactNode;
    colorOverride?: string;
    hideSign?: boolean;
}

export interface ResourceInlinePanelProps {
    address: string;
    details: GatewayEntityDetails | null;
    loading: boolean;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    tt: TranslationsT['dashboard']['transactions'];
    locale: string;
}

export interface NftTransferCardProps {
    resourceAddress: string;
    ids: string[];
    type: 'added' | 'removed';
    onCopy?: (v: string) => void;
    copiedAddress: string | null;
    formatEntity: (e: string) => string;
    onResourceClick?: (addr: string) => void;
    sourceMethod?: string;
    sourceColor?: string;
    sourceBg?: string;
    sourceTitle?: string;
    methodLabel?: string;
    readingMode?: boolean;
    tt: TranslationsT['dashboard']['transactions'];
    network: Network;
    side?: 'sender' | 'receiver';
    claimXrdTotal?: number;
    isClaim?: boolean;
    isStakeClaim?: boolean;
    isClaimRedeemed?: boolean;
    isBurned?: boolean;
    isClaimAuthorized?: boolean;
    unstakeXrdExpected?: number;
    nftReceivedLabel?: string;
    locale: string;
}

export interface NftCollectionPanelProps {
    resourceAddress: string;
    meta: GatewayEntityDetails | null | undefined;
    nftData: Record<string, unknown>[];
    nftLoading: boolean;
    ids: string[];
    type: 'added' | 'removed' | 'neutral';
    onCopy?: (v: string) => void;
    copiedAddress: string | null;
    tt: TranslationsT['dashboard']['transactions'];
    claimXrdTotal?: number;
    isClaim?: boolean;
    isStakeClaimOverride?: boolean;
    isClaimRedeemed?: boolean;
    isBurned?: boolean;
    isClaimAuthorized?: boolean;
    unstakeXrdExpected?: number;
    network: Network;
    locale: string;
}
