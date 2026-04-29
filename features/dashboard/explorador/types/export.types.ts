export interface ValidatorMapEntry {
    lsuResource: string;
    vaultAddress: string;
    name: string;
}

export interface AccountTx {
    date: string;
    timestamp: string;
    hash: string;
    txType: 'stake' | 'unstake' | 'claim' | 'trade' | 'deposit' | 'withdrawal' | 'other';
    balanceChanges: { resource: string; amount: number; direction: 'in' | 'out' }[];
    validatorOps: { validator: string; op: 'stake' | 'unstake' | 'claim'; xrd: number; lsu: number }[];
    fee: number;
}

export interface LedgerDayState {
    userLsu: number;
    lsuSupply: number;
    stakeVault: number;
}

export interface ValidatorRewardData {
    dailyDelegants?: Record<string, number>;
    dailyStake?: Record<string, number>;
    yearly?: Record<string, number>;
    yearlyDelegants?: Record<string, number>;
}

export interface StakingRewardRecord {
    date: string;
    validator: string;
    validatorName: string;
    accountXrd: number;
    totalAccountXrd: number;
    totalStake: number;
    proportion: number;
    rewardXrd: number;
}

// ── Gateway API Interfaces ───────────────────────────────────────────────────

export interface GatewayMetadataItem {
    key: string;
    value?: {
        typed?: {
            value?: string;
        };
    };
}

export interface GatewayValidatorItem {
    address?: string;
    state?: {
        address?: string;
        stake_unit_resource_address?: string;
        stake_xrd_vault?: {
            entity_address?: string;
        };
    };
    stake_unit_resource_address?: string;
    metadata?: {
        items?: GatewayMetadataItem[];
    };
}

export interface GatewayValidatorListResponse {
    validators?: {
        items?: GatewayValidatorItem[];
        next_cursor?: string | null;
    };
    items?: GatewayValidatorItem[];
    next_cursor?: string | null;
}

export interface GatewayEntityDetailsItem {
    address: string;
    fungible_resources?: {
        items?: {
            resource_address: string;
            amount?: string;
            balance?: {
                value?: string;
                amount?: string;
            };
        }[];
    };
    details?: {
        total_supply?: string;
        total_minted?: string;
        balance?: string | {
            amount?: string;
            value?: string;
        };
        amount?: string;
    };
    metadata?: {
        items?: GatewayMetadataItem[];
    };
}

export interface GatewayEntityDetailsResponse {
    items?: GatewayEntityDetailsItem[];
}

export interface GatewayTransactionItem {
    confirmed_at?: string;
    intent_hash?: string;
    transaction_hash?: string;
    balance_changes?: {
        fungible_fee_balance_changes?: {
            entity_address: string;
            balance_change?: string;
        }[];
        fungible_balance_changes?: {
            entity_address: string;
            balance_change?: string;
            resource_address?: string;
        }[];
    };
    receipt?: {
        events?: {
            name?: string;
            emitter?: {
                entity?: {
                    entity_address?: string;
                };
            };
            data?: {
                fields?: {
                    field_name?: string;
                    value?: string;
                }[];
                programmatic_json?: {
                    fields?: {
                        field_name?: string;
                        value?: string;
                    }[];
                };
            };
        }[];
    };
}

export interface GatewayTransactionStreamResponse {
    items?: GatewayTransactionItem[];
    next_cursor?: string | null;
}

export interface MathResult {
    records: StakingRewardRecord[];
    txTotalBalance: Record<string, number>;
}
