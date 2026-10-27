/**
 * Shared types for the Radix Console feature.
 */

export const CONSOLE_TOOL_SLUGS = [
  'mcp',
  'validator-info',
  'validator-registration',
  'validator-profile',
  'validator-staking',
  'validator-create',
  'account-deposits',
  'pool-info',
  'pool-create',
  'pool-contribute',
  'pool-reserves',
  'pool-redeem',
  'pool-profile',
  'pool-manage',
  'resource-holders',
  'bulk-send',
  'locker-info',
  'locker-airdrop',
  'locker-claim',
  'locker-recover',
  'send-transaction',
  'staking',
  'create-token',
  'my-resources',
  'build-manifest',
  'deploy-package',
  'transaction-manifest',
  'component-info',
  'component-panel',
  'configure-metadata',
  'convert-olympia-address',
  'sbor-decoder',
  'address-utils',
  'account-security',
  'address-book',
  'faucet',
  'wallet-playground',
  'claim-package-royalties',
  'sign-collection',
  'sign-document',
  'encrypt-document',
  'chat',
] as const;


export type ConsoleToolSlug = (typeof CONSOLE_TOOL_SLUGS)[number];

export function isConsoleToolSlug(value: string): value is ConsoleToolSlug {
  return (CONSOLE_TOOL_SLUGS as readonly string[]).includes(value);
}

/* ─── Wallet transaction ─────────────────────────────────────────────────── */

export interface ConsoleTxResult {
  transactionIntentHash: string;
  status: string;
  /** Entity addresses created by the transaction (resource, package, …) */
  createdEntities: string[];
}

/* ─── Account holdings (mapped from Gateway entity details) ──────────────── */

export interface FungibleHolding {
  resourceAddress: string;
  name: string;
  symbol: string;
  iconUrl?: string;
  amount: string;
  vaultAddress?: string;
  /** Set when the resource is a native pool unit: the pool it redeems from. */
  pool?: string;
}

export interface NonFungibleHolding {
  resourceAddress: string;
  name: string;
  iconUrl?: string;
  ids: string[];
  vaultAddress?: string;
}

export interface AccountHoldings {
  fungibles: FungibleHolding[];
  nonFungibles: NonFungibleHolding[];
}

/* ─── Badge proof (used by send & configure-metadata tools) ──────────────── */

export interface BadgeProofSelection {
  accountAddress: string;
  resourceAddress: string;
  /** Local id when the badge is a specific non-fungible */
  nonFungibleId?: string;
}
