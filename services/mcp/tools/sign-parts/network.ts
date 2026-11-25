/**
 * Shared network-isolation and domain-proof formatting helpers for Radix Seal
 * MCP tools.
 */
import type { RadixNetworkId } from '@/features/wallet/constants/network';
import type { DomainVerificationResult } from '@/features/sign/lib/domain-verify';
import {
  networkIdFromAccount,
  networkIdFromName,
  networkIdFromResource,
  networkMatchesAccount,
  networkMatchesCollection,
  networkNameForId,
} from '@/features/sign/lib/network';

/**
 * Resolves the target Radix network from an explicit parameter or Bech32
 * prefixes (`account`, `collection`, `sealResource`) and enforces strict
 * Mainnet / Stokenet isolation across every supplied address.
 */
export function resolveSealNetwork(input: {
  network?: 'mainnet' | 'stokenet';
  account?: string;
  collection?: string;
  sealResource?: string;
  collections?: string[];
  fallback?: RadixNetworkId;
}): { networkId: RadixNetworkId; network: 'mainnet' | 'stokenet' } {
  const inferred =
    (input.account ? networkIdFromAccount(input.account) : null) ??
    (input.collection ? networkIdFromResource(input.collection) : null) ??
    (input.sealResource ? networkIdFromResource(input.sealResource) : null);

  const networkId = input.network
    ? networkIdFromName(input.network)
    : (inferred ?? input.fallback);
  if (networkId == null) {
    throw new Error('Could not determine Radix network from address.');
  }
  const network = networkNameForId(networkId);

  if (input.account && !networkMatchesAccount(networkId, input.account)) {
    throw new Error(
      `Network mismatch: account "${input.account}" is not on ${network}.`,
    );
  }
  if (input.collection && !networkMatchesCollection(networkId, input.collection)) {
    throw new Error(
      `Network mismatch: collection "${input.collection}" is not on ${network}.`,
    );
  }
  if (
    input.sealResource &&
    !networkMatchesCollection(networkId, input.sealResource)
  ) {
    throw new Error(
      `Network mismatch: sealResource "${input.sealResource}" is not on ${network}.`,
    );
  }
  for (const addr of input.collections ?? []) {
    if (!networkMatchesCollection(networkId, addr)) {
      throw new Error(
        `Network mismatch: collection "${addr}" is not on ${network}.`,
      );
    }
  }
  return { networkId, network };
}

/** Formats a domain verification result for CLI output, or undefined when absent. */
export function formatDomainProof(
  verification: DomainVerificationResult | null | undefined,
): string | undefined {
  if (!verification?.domain) return undefined;
  return verification.verified
    ? `VERIFIED (${verification.domain} via ${verification.method})`
    : `unverified (${verification.domain})`;
}
