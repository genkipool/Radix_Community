/**
 * features/dashboard/explorador/constants.ts
 *
 * Static constants for the Transaction Explorer.
 * TRANSACTION_TAGS lives here (not in TransactionTabs) so DashboardToolbar
 * can import it without pulling in the entire tab component tree.
 */

export const TRANSACTION_TAGS = [
  'All', 'Success', 'Failed', 'With Message', 'With NFTs',
] as const;

export type TransactionTag = typeof TRANSACTION_TAGS[number];

/** Real Radix XRD Resource Addresses (Babylon) */
const XRD_ADDRESS_MAINNET = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const XRD_ADDRESS_STOKENET = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';

/** Helper to get context-aware XRD address */
export const getXrdAddress = (network?: string) => 
  network === 'stokenet' ? XRD_ADDRESS_STOKENET : XRD_ADDRESS_MAINNET;
