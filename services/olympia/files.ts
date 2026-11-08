/**
 * services/olympia/files.ts
 *
 * The one list of Olympia dataset files the explorer reads, with the column
 * each one is sorted by. Adding a lookup is one entry here plus a reader in the
 * module of its entity; no path string lives anywhere else.
 */

export const OLYMPIA_FILES = {
  accountsByAddress: { path: 'index/accounts_by_address.parquet', key: 'address' },
  accountsByBabylon: { path: 'index/accounts_by_babylon_address.parquet', key: 'babylon_address' },
  accountTxs: { path: 'index/account_tx_detail.parquet', key: 'account_id', order: 'state_version' },
  accountOperations: { path: 'index/operations_by_account.parquet', key: 'account_id', order: 'state_version' },
  accountBalanceChanges: { path: 'index/account_balance_changes.parquet', key: 'account_id', order: 'state_version' },
  accountFinalBalances: { path: 'index/account_final_balances.parquet', key: 'account_id' },
  accountFinalStakes: { path: 'index/account_final_stakes.parquet', key: 'account_id' },
  accountRewardsDaily: { path: 'index/account_staking_rewards_daily.parquet', key: 'account_id', order: 'day' },
  txById: { path: 'index/tx_by_id.parquet', key: 'transaction_id' },
  txByVersion: { path: 'index/user_tx_by_version.parquet', key: 'state_version' },
  operationsByVersion: { path: 'index/operations_by_version.parquet', key: 'state_version' },
  balanceChangesByVersion: { path: 'index/balance_changes_by_version.parquet', key: 'state_version' },
  rawTxByVersion: { path: 'index/raw_user_tx_by_version.parquet', key: 'state_version' },
  resourcesByRri: { path: 'index/resources_by_rri.parquet', key: 'rri' },
  resourcesByBabylon: { path: 'index/resources_by_babylon_address.parquet', key: 'babylon_resource_address' },
  holdersByResource: { path: 'index/final_balances_by_resource.parquet', key: 'rri' },
  validatorsByAddress: { path: 'index/validators_by_address.parquet', key: 'address' },
  delegatorsByValidator: { path: 'index/final_stakes_by_validator.parquet', key: 'validator_address' },
  validatorRewardsDaily: { path: 'index/validator_staking_rewards_daily.parquet', key: 'validator_address', order: 'day' },
} as const;
