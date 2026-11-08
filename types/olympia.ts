/**
 * Shapes of the Olympia data the `/api/olympia/*` routes return.
 * Amounts are decimal strings in whole tokens (exact); `*Num` fields are the
 * same value as a number, for sums and charts.
 */

export interface OlympiaTokenAmount {
  rri: string;
  symbol: string;
  name: string | null;
  iconUrl: string | null;
  amount: string;
  amountNum: number;
}

export interface OlympiaStake {
  validatorAddress: string;
  validatorName: string | null;
  /** XRD value of the stake units held at the end of Olympia. */
  stakedXrd: number;
  /** XRD staked in the last epoch, not yet converted into stake units. */
  pendingStakeXrd: number;
  /** XRD value of the stake units being unstaked (prepared, not yet exiting). */
  pendingUnstakeXrd: number;
  /** XRD unstaked and waiting for the unlock epoch. */
  exitingXrd: number;
}

export interface OlympiaAccountSummary {
  address: string;
  babylonAddress: string;
  publicKey: string;
  firstSeenStateVersion: number;
  xrd: OlympiaTokenAmount | null;
  /** Tokens other than XRD with a balance at the end of Olympia. */
  tokens: OlympiaTokenAmount[];
  stakes: OlympiaStake[];
  totals: {
    liquidXrd: number;
    stakedXrd: number;
    pendingStakeXrd: number;
    unstakingXrd: number;
    /** Liquid + staked + pending + unstaking. */
    totalXrd: number;
  };
  activity: {
    txCount: number;
    firstTx: { stateVersion: number; timestamp: string | null } | null;
    lastTx: { stateVersion: number; timestamp: string | null } | null;
    /** Fees paid as fee payer, in XRD. */
    feesPaidXrd: number;
  };
  rewards: {
    delegatorXrd: number;
    validatorFeeXrd: number;
    years: number[];
  };
}

export interface OlympiaAction {
  index: number;
  type: string | null;
  from: string | null;
  to: string | null;
  validator: string | null;
  validatorName?: string | null;
  amount: string | null;
  amountNum: number;
  rri: string | null;
  symbol: string;
}

export interface OlympiaBalanceChange {
  address?: string;
  rri: string;
  symbol: string;
  /** Token name and icon from the archive's token catalog (when it has them). */
  name?: string | null;
  iconUrl?: string | null;
  delta: string;
  deltaNum: number;
}

export interface OlympiaTxItem {
  transactionId: string;
  stateVersion: number;
  timestamp: string | null;
  feeXrd: number;
  isFeePayer?: boolean;
  message: string | null;
  messageEncrypted: boolean;
  /** Actions of the account the list belongs to (account lists) or all actions (detail). */
  actions: OlympiaAction[];
  /** Balance changes of the account the list belongs to. */
  balanceChanges: OlympiaBalanceChange[];
}

export interface OlympiaTxPage {
  items: OlympiaTxItem[];
  /** State version to pass as `before` for the next page; absent at the end. */
  nextCursor?: string;
}

export interface OlympiaTxDetail extends OlympiaTxItem {
  epoch: number;
  round: number;
  feePayer: string | null;
  accountsCount: number;
  allBalanceChanges: OlympiaBalanceChange[];
  rawHex: string | null;
}

export interface OlympiaResource {
  rri: string;
  babylonAddress: string | null;
  symbol: string;
  name: string | null;
  description: string | null;
  url: string | null;
  iconUrl: string | null;
  isMutable: boolean | null;
  granularity: string | null;
  owner: string | null;
  createdStateVersion: number;
  totalSupply: string;
  totalMinted: string;
  totalBurnt: string;
  holders: number;
  topHolders: { address: string; amount: string; amountNum: number }[];
}

export interface OlympiaValidator {
  address: string;
  name: string | null;
  url: string | null;
  /** Fee in percent (as the Olympia Gateway stored it: 100 = 100 %). */
  feePercent: number | null;
  isRegistered: boolean | null;
  allowDelegation: boolean | null;
  owner: string | null;
  ownerBabylonAddress?: string | null;
  /** The node key (compressed secp256k1, hex): it signed every change to the validator. */
  publicKey?: string | null;
  totalStakedXrd: number;
  delegators: number;
  topDelegators: { address: string; stakedXrd: number }[];
  rewards: { delegatorsXrd: number; ownerFeeXrd: number; years: number[] };
  /** XRD the owner had staked to it when Olympia ended (null when it had none). */
  ownerStakeXrd?: number | null;
  /** Its share of all XRD staked when Olympia ended, in percent. */
  networkSharePercent?: number | null;
  /** XRD one stake unit was worth when Olympia ended. */
  xrdPerStakeUnit?: number | null;
  /** Total stake at the end of each day, oldest first. */
  stakeHistory?: { day: string; stakeXrd: number }[];
  /** XRD staked to and unstaked from it per UTC day, oldest first (only days with movements). */
  stakeActivity?: { day: string; stake: number; unstake: number }[];
  /** Proposals over the whole of Olympia (null: it never was asked to propose). */
  proposals?: { completed: number; missed: number; uptimePercent: number } | null;
}

export interface OlympiaDailyReward {
  day: string;
  validatorAddress: string;
  validatorName: string | null;
  delegatorXrd: number;
  feeXrd: number;
}

export interface OlympiaValidatorDay {
  day: string;
  delegatorsXrd: number;
  feeXrd: number;
  totalStakeXrd: number;
}

/** What the explorer needs to link a Babylon account to its Olympia past. */
export interface OlympiaLink {
  olympiaAddress: string;
  babylonAddress: string;
}
