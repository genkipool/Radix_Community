/**
 * Pure LSU (Liquid Stake Unit) inspection & lookup helpers.
 * Shared by the Console UI (`LsuInfoTool`) and the MCP server (`inspect_lsu`).
 *
 * Queries the Radix Gateway directly (zero Redis commands).
 */

import { getMetadataString, type GatewayMetadataItem } from './metadata-manifests';
import type { GatewayPost } from './resource-holders';

export interface LsuInfo {
  lsuAddress: string;
  lsuName: string;
  lsuSymbol: string;
  lsuIconUrl?: string;
  totalSupply: number;
  validatorAddress: string;
  validatorName: string;
  validatorIconUrl?: string;
  validatorInfoUrl?: string;
  isRegistered: boolean;
  acceptsDelegatedStake: boolean;
  /** Fee percentage, e.g. 2.5 for 2.5%. */
  feePercent: number;
  publicKey: string;
  claimNftResource: string;
  stakeVaultAddress: string;
  stakeVaultXrd: number;
  pendingWithdrawXrd: number;
  lockedOwnerLsu: number;
  lockedOwnerXrd: number;
  /** Current exchange rate: how much XRD 1 LSU redeems for. */
  xrdPerLsu: number;
  /** Inverse rate: how many LSU 1 XRD mints. */
  lsuPerXrd: number;
}

interface GatewayEntityItem {
  address: string;
  metadata?: { items?: GatewayMetadataItem[] };
  details?: {
    type?: string;
    total_supply?: string;
    balance?: { amount?: string; value?: string } | string;
    state?: {
      is_registered?: boolean;
      accepts_delegated_stake?: boolean;
      validator_fee_factor?: string | number;
      stake_unit_resource_address?: string;
      claim_token_resource_address?: string;
      public_key?: { key_hex?: string };
      stake_xrd_vault?: { entity_address?: string };
      pending_xrd_withdraw_vault?: { entity_address?: string };
      locked_owner_stake_unit_vault?: { entity_address?: string };
    };
  };
}

function parseVaultAmount(item: GatewayEntityItem | undefined): number {
  const bal = item?.details?.balance;
  if (!bal) return 0;
  if (typeof bal === 'string') return parseFloat(bal) || 0;
  return parseFloat(bal.amount ?? bal.value ?? '0') || 0;
}

/**
 * Resolves full LSU + owning validator + vault + exchange-rate info in 2–3
 * lightweight Gateway calls. Returns null if the address is not a valid LSU.
 */
export async function fetchLsuInfo(post: GatewayPost, lsuAddress: string): Promise<LsuInfo | null> {
  const trimmed = lsuAddress.trim();
  if (!trimmed.startsWith('resource_')) return null;

  // 1. Fetch LSU resource details + metadata (includes `validator` address)
  const lsuRes = (await post('/state/entity/details', {
    addresses: [trimmed],
    opt_ins: { explicit_metadata: ['name', 'symbol', 'icon_url', 'validator'] },
  })) as { items?: GatewayEntityItem[] };

  const lsuItem = lsuRes.items?.[0];
  if (!lsuItem) return null;

  const lsuMeta = lsuItem.metadata?.items;
  const validatorAddress = getMetadataString(lsuMeta, 'validator');
  if (!validatorAddress || !validatorAddress.startsWith('validator_')) return null;

  const totalSupply = parseFloat(lsuItem.details?.total_supply ?? '0') || 0;

  // 2. Fetch owning validator state + metadata
  const valRes = (await post('/state/entity/details', {
    addresses: [validatorAddress],
    opt_ins: { explicit_metadata: ['name', 'icon_url', 'info_url'] },
  })) as { items?: GatewayEntityItem[] };

  const valItem = valRes.items?.[0];
  const state = valItem?.details?.state;
  if (!valItem || !state) return null;

  // Confirm two-way link: validator's stake_unit_resource_address must match this LSU
  if (state.stake_unit_resource_address && state.stake_unit_resource_address !== trimmed) {
    return null;
  }

  const stakeVaultAddress = state.stake_xrd_vault?.entity_address ?? '';
  const pendingVaultAddress = state.pending_xrd_withdraw_vault?.entity_address ?? '';
  const ownerVaultAddress = state.locked_owner_stake_unit_vault?.entity_address ?? '';

  // 3. Fetch the 3 internal vaults in a single batched Gateway call
  const vaultAddrs = [stakeVaultAddress, pendingVaultAddress, ownerVaultAddress].filter(Boolean);
  let stakeVaultXrd = 0;
  let pendingWithdrawXrd = 0;
  let lockedOwnerLsu = 0;

  if (vaultAddrs.length > 0) {
    const vaultsRes = (await post('/state/entity/details', {
      addresses: vaultAddrs,
    })) as { items?: GatewayEntityItem[] };
    const byAddr = new Map((vaultsRes.items ?? []).map((it) => [it.address, it]));
    stakeVaultXrd = parseVaultAmount(byAddr.get(stakeVaultAddress));
    pendingWithdrawXrd = parseVaultAmount(byAddr.get(pendingVaultAddress));
    lockedOwnerLsu = parseVaultAmount(byAddr.get(ownerVaultAddress));
  }

  const xrdPerLsu = totalSupply > 0 ? stakeVaultXrd / totalSupply : 1;
  const lsuPerXrd = xrdPerLsu > 0 ? 1 / xrdPerLsu : 1;
  const feeFactor = parseFloat(String(state.validator_fee_factor ?? '0')) || 0;
  const valMeta = valItem.metadata?.items;

  return {
    lsuAddress: trimmed,
    lsuName: getMetadataString(lsuMeta, 'name') || 'Stake Unit',
    lsuSymbol: getMetadataString(lsuMeta, 'symbol') || 'LSU',
    lsuIconUrl: getMetadataString(lsuMeta, 'icon_url') || undefined,
    totalSupply,
    validatorAddress,
    validatorName: getMetadataString(valMeta, 'name') || validatorAddress.slice(0, 24),
    validatorIconUrl: getMetadataString(valMeta, 'icon_url') || undefined,
    validatorInfoUrl: getMetadataString(valMeta, 'info_url') || undefined,
    isRegistered: state.is_registered ?? false,
    acceptsDelegatedStake: state.accepts_delegated_stake ?? false,
    feePercent: feeFactor * 100,
    publicKey: state.public_key?.key_hex ?? '',
    claimNftResource: state.claim_token_resource_address ?? '',
    stakeVaultAddress,
    stakeVaultXrd,
    pendingWithdrawXrd,
    lockedOwnerLsu,
    lockedOwnerXrd: lockedOwnerLsu * xrdPerLsu,
    xrdPerLsu,
    lsuPerXrd,
  };
}
