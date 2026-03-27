import React from 'react';
import type {
    Network,
    GatewayEntityDetails,
    TranslationsT,
    TransactionDetails
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


export interface AssetTransferGroupProps {
    group: FungibleChange[];
    balanceChanges: BalanceChanges;
    allSenderAddresses: Set<string>;
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
    validatorOps?: ValidatorOp[];
    /** For unstake: the validatorOp paired with this LSU group */
    pairedValidatorOp?: ValidatorOp;
    /** For unstake: the NFT change (added) paired with this LSU group */
    pairedNftChange?: NonFungibleChange;
    columns: number;
}

export interface TransferFooterProps {
    senders: FungibleChange[];
    receivers: FungibleChange[];
    actualFeePaid: string;
    tt: TranslationsT['dashboard']['transactions'];
    resourceAddress?: string;
    network?: Network;
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
}

export interface ResourceInlinePanelProps {
    address: string;
    details: GatewayEntityDetails | null;
    loading: boolean;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    tt: TranslationsT['dashboard']['transactions'];
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
    unstakeXrdExpected?: number;
    nftReceivedLabel?: string;
}

export interface NftCollectionPanelProps {
    resourceAddress: string;
    meta: GatewayEntityDetails | null | undefined;
    nftData: Record<string, unknown>[];
    nftLoading: boolean;
    ids: string[];
    type: 'added' | 'removed';
    onCopy?: (v: string) => void;
    copiedAddress: string | null;
    tt: TranslationsT['dashboard']['transactions'];
    claimXrdTotal?: number;
    isClaim?: boolean;
    isStakeClaimOverride?: boolean;
    unstakeXrdExpected?: number;
    network: Network;
}
