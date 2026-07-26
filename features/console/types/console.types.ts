/**
 * Shared types for the Radix Console feature.
 */

export const CONSOLE_TOOL_SLUGS = [
  'mcp',
  'send-transaction',
  'staking',
  'create-token',
  'my-resources',
  'build-manifest',
  'deploy-package',
  'transaction-manifest',
  'component-panel',
  'configure-metadata',
  'convert-olympia-address',
  'sbor-decoder',
  'address-utils',
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
