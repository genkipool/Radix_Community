/**
 * Pure Account Migration / Sweep engine.
 * Shared by `AccountMigrateTool` (UI) and `prepare_account_migrate` (MCP).
 *
 * Classifies holdings (XRD, fungibles, LSUs, NFTs, critical system badges),
 * reserves XRD for transaction fees, and partitions transfers into safe
 * transaction batches with XRD always sent last so earlier batches can pay fees.
 */

import Big from 'big.js';
import type { AccountHoldings } from '../types/console.types';
import type { BatchItem } from '../components/shared/BatchRunner';
import type { GatewayPost } from './resource-holders';
import { isFreelyWithdrawable } from './role-lookup';

export type MigrateAssetKind = 'xrd' | 'fungible' | 'nft' | 'criticalBadge';

export interface MigrateItem {
  id: string;
  resourceAddress: string;
  kind: MigrateAssetKind;
  name: string;
  symbol?: string;
  iconUrl?: string;
  /** Decimal amount for fungibles / XRD. */
  amount?: string;
  /** Local IDs for NFTs / non-fungible badges. */
  nftIds?: string[];
  /** True for system owner badges (validator/package/account/identity owner). */
  isCriticalBadge?: boolean;
}

/** Well-known Radix system owner badges (mainnet & stokenet patterns). */
const CRITICAL_BADGE_PATTERNS = [
  'vdrwnr', // Validator owner badge
  'pkgwnr', // Package owner badge
  'accwnr', // Account owner badge
  'idwnr',  // Identity owner badge
];

export function isCriticalSystemBadge(resourceAddress: string): boolean {
  const lower = resourceAddress.toLowerCase();
  return CRITICAL_BADGE_PATTERNS.some((tag) => lower.includes(tag));
}

export function isXrdResource(resourceAddress: string): boolean {
  return resourceAddress.toLowerCase().includes('radxrd');
}

/**
 * Queries Gateway `/state/entity/details` in chunks of 20 and returns the set
 * of resource addresses whose `withdrawer` role is NOT `AllowAll` (i.e. soulbound
 * or badge-gated resources that would fail `FungibleVault::take` / `NonFungibleVault::take`
 * without presenting a restricted badge).
 */
export async function inspectNonWithdrawableResources(
  post: GatewayPost,
  resourceAddresses: string[],
): Promise<Set<string>> {
  const blocked = new Set<string>();
  const unique = [...new Set(resourceAddresses.filter((a) => a && !isXrdResource(a)))];

  for (let i = 0; i < unique.length; i += 20) {
    const chunk = unique.slice(i, i + 20);
    const res = await post<{ items?: Array<{ address: string; details?: unknown }> }>(
      '/state/entity/details',
      { addresses: chunk },
    );
    for (const item of res.items ?? []) {
      if (!isFreelyWithdrawable(item)) {
        blocked.add(item.address);
      }
    }
  }
  return blocked;
}

/** Flattens account holdings into selectable migration items with clear categories. */
export function buildMigrateItems(holdings: AccountHoldings): MigrateItem[] {
  const items: MigrateItem[] = [];

  for (const f of holdings.fungibles) {
    const amt = parseFloat(f.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const isXrd = isXrdResource(f.resourceAddress);
    items.push({
      id: `f:${f.resourceAddress}`,
      resourceAddress: f.resourceAddress,
      kind: isXrd ? 'xrd' : 'fungible',
      name: f.name || f.symbol || f.resourceAddress.slice(0, 18),
      symbol: f.symbol || (isXrd ? 'XRD' : undefined),
      iconUrl: f.iconUrl,
      amount: f.amount,
    });
  }

  for (const nf of holdings.nonFungibles) {
    if (!nf.ids || nf.ids.length === 0) continue;
    const critical = isCriticalSystemBadge(nf.resourceAddress);
    items.push({
      id: `nf:${nf.resourceAddress}`,
      resourceAddress: nf.resourceAddress,
      kind: critical ? 'criticalBadge' : 'nft',
      name: nf.name || nf.resourceAddress.slice(0, 18),
      iconUrl: nf.iconUrl,
      nftIds: nf.ids,
      isCriticalBadge: critical,
    });
  }

  return items;
}

/** Computes how much XRD can be sent after keeping `reserveXrd` in the source account. */
export function computeSendableXrd(balanceStr: string, reserveXrd: string): string {
  try {
    const bal = new Big((balanceStr || '0').replace(',', '.'));
    const res = new Big((reserveXrd || '0').trim().replace(',', '.') || '0');
    const diff = bal.minus(res.lt(0) ? new Big(0) : res);
    return diff.gt(0) ? diff.toFixed() : '0';
  } catch {
    return '0';
  }
}

const MAX_OPS_PER_BATCH = 20;
const MAX_NFT_IDS_PER_CALL = 40;

interface SingleOp {
  instruction: string;
  weight: number;
}

/**
 * Generates batched Radix transaction manifests to sweep selected assets from
 * `fromAccount` to `toAccount`.
 *
 * Non-XRD assets are scheduled first; XRD (minus `xrdReserve`) is placed in the
 * final batch so earlier batches always have enough XRD in `fromAccount` for fees.
 */
export function buildMigrateBatches(
  fromAccount: string,
  toAccount: string,
  selectedItems: MigrateItem[],
  xrdReserve = '2',
): BatchItem[] {
  if (!fromAccount || !toAccount || fromAccount === toAccount || selectedItems.length === 0) {
    return [];
  }

  const nonXrdOps: SingleOp[] = [];
  const xrdOps: SingleOp[] = [];

  for (const item of selectedItems) {
    if (item.kind === 'xrd') {
      const sendable = computeSendableXrd(item.amount ?? '0', xrdReserve);
      if (new Big(sendable).gt(0)) {
        xrdOps.push({
          weight: 1,
          instruction: `CALL_METHOD\n    Address("${fromAccount}")\n    "withdraw"\n    Address("${item.resourceAddress}")\n    Decimal("${sendable}")\n;`,
        });
      }
    } else if (item.kind === 'fungible' && item.amount) {
      nonXrdOps.push({
        weight: 1,
        instruction: `CALL_METHOD\n    Address("${fromAccount}")\n    "withdraw"\n    Address("${item.resourceAddress}")\n    Decimal("${item.amount}")\n;`,
      });
    } else if ((item.kind === 'nft' || item.kind === 'criticalBadge') && item.nftIds?.length) {
      for (let i = 0; i < item.nftIds.length; i += MAX_NFT_IDS_PER_CALL) {
        const chunk = item.nftIds.slice(i, i + MAX_NFT_IDS_PER_CALL);
        const idsList = chunk.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
        nonXrdOps.push({
          weight: Math.max(1, Math.ceil(chunk.length / 10)),
          instruction: `CALL_METHOD\n    Address("${fromAccount}")\n    "withdraw_non_fungibles"\n    Address("${item.resourceAddress}")\n    Array<NonFungibleLocalId>(${idsList})\n;`,
        });
      }
    }
  }

  const allOps = [...nonXrdOps, ...xrdOps];
  if (allOps.length === 0) return [];

  const batches: BatchItem[] = [];
  let current: SingleOp[] = [];
  let currentWeight = 0;

  const flush = () => {
    if (current.length === 0) return;
    const manifest = [
      ...current.map((op) => op.instruction),
      `CALL_METHOD\n    Address("${toAccount}")\n    "try_deposit_batch_or_abort"\n    Expression("ENTIRE_WORKTOP")\n    Enum<0u8>()\n;`,
    ].join('\n');
    batches.push({ manifest, count: current.length });
    current = [];
    currentWeight = 0;
  };

  for (const op of allOps) {
    if (current.length > 0 && currentWeight + op.weight > MAX_OPS_PER_BATCH) {
      flush();
    }
    current.push(op);
    currentWeight += op.weight;
  }
  flush();

  return batches;
}
