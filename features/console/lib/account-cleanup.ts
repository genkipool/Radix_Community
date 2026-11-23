/**
 * Pure Account Cleanup (Spam / Dust Sweeper + Auto-Deny) engine.
 * Shared by `AccountCleanupTool` (UI) and `prepare_account_cleanup` (MCP).
 *
 * Inspects which account resources are freely burnable (`burner = AllowAll`),
 * protects XRD / validator LSUs / system owner badges, and builds batched
 * manifests that burn (or sweep to an optional sink account) and optionally
 * block future deposits via `set_resource_preference(Disallowed)`.
 */

import type { AccountHoldings } from '../types/console.types';
import type { BatchItem } from '../components/shared/BatchRunner';
import type { GatewayPost } from './resource-holders';
import { isCriticalSystemBadge, isXrdResource } from './account-migrate';
import { isFreelyWithdrawable } from './role-lookup';

export interface CleanupItem {
  resourceAddress: string;
  isNonFungible: boolean;
  name: string;
  symbol?: string;
  iconUrl?: string;
  amount?: string;
  nftIds?: string[];
  /** True when the resource's `burner` role is `AllowAll` (anyone can burn their own tokens). */
  burnable: boolean;
  /** True when the resource's `withdrawer` role is `AllowAll` (can leave the account without a special badge). */
  withdrawable?: boolean;
  /** True for XRD, validator LSUs, and system owner badges (hidden/protected by default). */
  protected: boolean;
}

interface RoleEntry {
  role_key?: { name?: string };
  assignment?: {
    resolution?: string;
    explicit_rule?: { type?: string };
  };
}

interface EntityRoleItem {
  address: string;
  metadata?: { items?: Array<{ key?: string; value?: { typed?: { value?: string } } }> };
  details?: {
    role_assignments?: {
      entries?: RoleEntry[];
    };
  };
}

function isFreelyBurnable(item: EntityRoleItem | undefined): boolean {
  const entries = item?.details?.role_assignments?.entries ?? [];
  const burner = entries.find((e) => e.role_key?.name === 'burner');
  if (!burner) return false;
  return burner.assignment?.explicit_rule?.type === 'AllowAll';
}

function hasValidatorMetadata(item: EntityRoleItem | undefined): boolean {
  const meta = item?.metadata?.items ?? [];
  return meta.some((m) => m.key === 'validator' && typeof m.value?.typed?.value === 'string' && m.value.typed.value.startsWith('validator_'));
}

/**
 * Queries Gateway `/state/entity/details` in chunks of 20 to determine
 * burnability and validator-LSU/claim protection for every resource in `holdings`.
 */
export async function inspectCleanupItems(
  post: GatewayPost,
  holdings: AccountHoldings,
): Promise<CleanupItem[]> {
  const rawResources = [
    ...holdings.fungibles
      .filter((f) => parseFloat(f.amount) > 0)
      .map((f) => ({
        resourceAddress: f.resourceAddress,
        isNonFungible: false,
        name: f.name || f.symbol || f.resourceAddress.slice(0, 18),
        symbol: f.symbol || undefined,
        iconUrl: f.iconUrl,
        amount: f.amount,
      })),
    ...holdings.nonFungibles
      .filter((nf) => nf.ids.length > 0)
      .map((nf) => ({
        resourceAddress: nf.resourceAddress,
        isNonFungible: true,
        name: nf.name || nf.resourceAddress.slice(0, 18),
        iconUrl: nf.iconUrl,
        nftIds: nf.ids,
      })),
  ];

  const detailsByAddr = new Map<string, EntityRoleItem>();
  const addrs = rawResources.map((r) => r.resourceAddress);

  for (let i = 0; i < addrs.length; i += 20) {
    const chunk = addrs.slice(i, i + 20);
    const res = await post<{ items?: EntityRoleItem[] }>('/state/entity/details', {
      addresses: chunk,
      opt_ins: { explicit_metadata: ['validator'] },
    });
    for (const item of res.items ?? []) {
      detailsByAddr.set(item.address, item);
    }
  }

  return rawResources.map((r) => {
    const entity = detailsByAddr.get(r.resourceAddress);
    const isProtected =
      isXrdResource(r.resourceAddress)
      || isCriticalSystemBadge(r.resourceAddress)
      || hasValidatorMetadata(entity);
    const withdrawable = entity?.details?.role_assignments ? isFreelyWithdrawable(entity) : true;

    return {
      ...r,
      withdrawable,
      burnable: withdrawable && isFreelyBurnable(entity),
      protected: isProtected,
    };
  });
}

const MAX_CLEANUP_PER_BATCH = 12;

export interface BuildCleanupOptions {
  account: string;
  items: CleanupItem[];
  /** Add each cleaned resource to `Disallowed` deposit rules in the same tx. */
  denyDeposits: boolean;
  /** Optional sink account for non-burnable items; if omitted, non-burnable items are skipped (or only denied). */
  sinkAccount?: string;
}

/**
 * Builds batched manifests that:
 * - burn selected burnable resources (`withdraw` -> `take_all_from_worktop` -> `burn_resource`),
 * - sweep selected non-burnable resources to `sinkAccount` (if provided and freely withdrawable),
 * - and optionally set `set_resource_preference(..., Disallowed)` on the account.
 */
export function buildCleanupBatches({
  account,
  items,
  denyDeposits,
  sinkAccount,
}: BuildCleanupOptions): BatchItem[] {
  if (!account || items.length === 0) return [];
  const validSink = sinkAccount && sinkAccount !== account ? sinkAccount.trim() : '';
  const canTake = (item: CleanupItem) => item.withdrawable !== false;

  const actionable = items.filter(
    (item) => (item.burnable && canTake(item)) || (!!validSink && canTake(item)) || denyDeposits,
  );
  if (actionable.length === 0) return [];

  const batches: BatchItem[] = [];

  for (let i = 0; i < actionable.length; i += MAX_CLEANUP_PER_BATCH) {
    const slice = actionable.slice(i, i + MAX_CLEANUP_PER_BATCH);
    const lines: string[] = [];
    let hasSinkDeposits = false;

    slice.forEach((item, idx) => {
      const bucket = `burn_${idx}`;

      if (item.burnable && canTake(item)) {
        if (item.isNonFungible && item.nftIds?.length) {
          const idsList = item.nftIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
          lines.push(
            `CALL_METHOD\n    Address("${account}")\n    "withdraw_non_fungibles"\n    Address("${item.resourceAddress}")\n    Array<NonFungibleLocalId>(${idsList})\n;`,
          );
        } else if (!item.isNonFungible && item.amount) {
          lines.push(
            `CALL_METHOD\n    Address("${account}")\n    "withdraw"\n    Address("${item.resourceAddress}")\n    Decimal("${item.amount}")\n;`,
          );
        }
        lines.push(
          `TAKE_ALL_FROM_WORKTOP\n    Address("${item.resourceAddress}")\n    Bucket("${bucket}")\n;`,
        );
        lines.push(`BURN_RESOURCE\n    Bucket("${bucket}")\n;`);
      } else if (validSink && canTake(item)) {
        if (item.isNonFungible && item.nftIds?.length) {
          const idsList = item.nftIds.map((id) => `NonFungibleLocalId("${id}")`).join(', ');
          lines.push(
            `CALL_METHOD\n    Address("${account}")\n    "withdraw_non_fungibles"\n    Address("${item.resourceAddress}")\n    Array<NonFungibleLocalId>(${idsList})\n;`,
          );
          hasSinkDeposits = true;
        } else if (!item.isNonFungible && item.amount) {
          lines.push(
            `CALL_METHOD\n    Address("${account}")\n    "withdraw"\n    Address("${item.resourceAddress}")\n    Decimal("${item.amount}")\n;`,
          );
          hasSinkDeposits = true;
        }
      }

      if (denyDeposits) {
        lines.push(
          `CALL_METHOD\n    Address("${account}")\n    "set_resource_preference"\n    Address("${item.resourceAddress}")\n    Enum<ResourcePreference::Disallowed>()\n;`,
        );
      }
    });

    if (hasSinkDeposits && validSink) {
      lines.push(
        `CALL_METHOD\n    Address("${validSink}")\n    "try_deposit_batch_or_abort"\n    Expression("ENTIRE_WORKTOP")\n    Enum<0u8>()\n;`,
      );
    }

    if (lines.length > 0) {
      batches.push({ manifest: lines.join('\n'), count: slice.length });
    }
  }

  return batches;
}
