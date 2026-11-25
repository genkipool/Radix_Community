/**
 * Single source of truth for Radix Seal network mapping, Bech32 address
 * validation, and NFT global-id splitting across Web UI, API routes, and MCP.
 */
import { RadixNetworkId } from '@/features/wallet/constants/network';

export type SealNetworkName = 'mainnet' | 'stokenet';

/** Canonical Bech32 regexes for Mainnet (`rdx1`) and Stokenet (`tdx_2_1`). */
export const RADIX_RESOURCE_RE = /^resource_(rdx|tdx_2_)1[a-z0-9]+$/;
export const RADIX_ACCOUNT_RE = /^account_(rdx|tdx_2_)1[a-z0-9]+$/;
export const DOC_HASH_HEX_RE = /^[0-9a-f]{64}$/;

/** True when `networkId` is Mainnet (1) or Stokenet (2). */
export function isSupportedNetworkId(
  networkId: number,
): networkId is RadixNetworkId {
  return (
    networkId === RadixNetworkId.Mainnet ||
    networkId === RadixNetworkId.Stokenet
  );
}

/** Human / Gateway network name recorded in attestation metadata and API calls. */
export function networkNameForId(networkId: number): SealNetworkName {
  return networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}

/** Same as `networkNameForId`, returning `undefined` for unsupported ids. */
export function optionalNetworkNameForId(
  networkId: number,
): SealNetworkName | undefined {
  if (networkId === RadixNetworkId.Mainnet) return 'mainnet';
  if (networkId === RadixNetworkId.Stokenet) return 'stokenet';
  return undefined;
}

export function networkIdFromName(network: SealNetworkName): RadixNetworkId {
  return network === 'mainnet'
    ? RadixNetworkId.Mainnet
    : RadixNetworkId.Stokenet;
}

/** `resource_rdx1…` → Mainnet (1), `resource_tdx_2_1…` → Stokenet (2). */
export function networkIdFromResource(address: string): RadixNetworkId | null {
  if (address.startsWith('resource_rdx1')) return RadixNetworkId.Mainnet;
  if (address.startsWith('resource_tdx_2_1')) return RadixNetworkId.Stokenet;
  return null;
}

/** `account_rdx1…` → Mainnet (1), `account_tdx_2_1…` → Stokenet (2). */
export function networkIdFromAccount(account: string): RadixNetworkId | null {
  if (account.startsWith('account_rdx1')) return RadixNetworkId.Mainnet;
  if (account.startsWith('account_tdx_2_1')) return RadixNetworkId.Stokenet;
  return null;
}

/** Canonical account Bech32 prefix for the given network id. */
export function accountPrefixForNetwork(
  networkId: number,
): 'account_rdx1' | 'account_tdx_2_1' {
  return networkId === RadixNetworkId.Mainnet
    ? 'account_rdx1'
    : 'account_tdx_2_1';
}

/** True when `networkId` agrees with the resource's Bech32 prefix. */
export function networkMatchesCollection(
  networkId: number,
  collection: string,
): boolean {
  const inferred = networkIdFromResource(collection);
  return inferred !== null && inferred === networkId;
}

/** True when `networkId` agrees with the account's Bech32 prefix. */
export function networkMatchesAccount(
  networkId: number,
  account: string,
): boolean {
  const inferred = networkIdFromAccount(account);
  return inferred !== null && inferred === networkId;
}

/** Splits `<resource>:<localId>` into its resource address and local NFT id. */
export function splitNftGlobalId(globalId: string): {
  resource: string;
  localId: string;
} {
  const idx = globalId.indexOf(':');
  if (idx < 0) return { resource: globalId, localId: globalId };
  return {
    resource: globalId.slice(0, idx),
    localId: globalId.slice(idx + 1),
  };
}
