/**
 * Resolves a recall/freeze target into the internal vault address the ledger
 * instructions need. Users know account addresses, not `internal_vault_…` ids,
 * so a single input accepts either and this resolves it:
 *
 *   - `account_…`        → the vault in that account holding `resource`
 *                          (an account holds a resource in exactly one vault),
 *                          plus the NFT ids in it for non-fungibles.
 *   - `internal_vault_…` → used as-is (covers vaults inside components / dApps
 *                          that have no owning account).
 */
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { mapHoldings } from './account-holdings';

export interface ResolvedVault {
  vault: string;
  /** NFT ids known to be in the vault (empty for fungibles / raw vault input). */
  ids: string[];
}

export type TargetKind = 'account' | 'vault' | 'unknown';

/** Classifies a target string by its bech32m entity prefix. */
export function targetKind(input: string): TargetKind {
  const t = input.trim();
  if (t.startsWith('account_')) return 'account';
  if (t.startsWith('internal_vault_')) return 'vault';
  return 'unknown';
}

/**
 * Resolves a recall/freeze target into a vault address (+ NFT ids when known).
 * Returns null when the string is neither an account nor a vault, or when the
 * account does not hold `resource`.
 */
export async function resolveTargetVault(
  input: string,
  resource: string,
  network: 'mainnet' | 'stokenet',
): Promise<ResolvedVault | null> {
  const t = input.trim();
  const kind = targetKind(t);
  if (kind === 'vault') return { vault: t, ids: [] };
  if (kind !== 'account') return null;

  const details = await apiFetchEntityDetails(t, network);
  const holdings = mapHoldings(details as unknown as Record<string, unknown>);
  const fungible = holdings.fungibles.find((x) => x.resourceAddress === resource);
  if (fungible?.vaultAddress) return { vault: fungible.vaultAddress, ids: [] };
  const nonFungible = holdings.nonFungibles.find((x) => x.resourceAddress === resource);
  if (nonFungible?.vaultAddress) {
    return { vault: nonFungible.vaultAddress, ids: nonFungible.ids };
  }
  return null;
}
