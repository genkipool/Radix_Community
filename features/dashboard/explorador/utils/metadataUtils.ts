/**
 * features/dashboard/explorador/utils/metadataUtils.ts
 *
 * Shared metadata extraction helpers for the Transaction Explorer.
 * Used by BalanceChangeRow, NftTransferCard, ValidatorInlinePanel,
 * TransactionDetailsTab, etc. — eliminates 5× duplication.
 */

import type { MetadataItem, MetadataValue } from '@/features/dashboard/types/shared.types';

/**
 * Resolves a metadata value from gateway metadata items by key.
 * Handles all known value shapes: typed, url, programmatic_json.
 */
export function getMetaValue(items: MetadataItem[], key: string): string | undefined {
  const v: MetadataValue | undefined = items.find((m) => m.key === key)?.value;
  return (
    v?.typed?.value ??
    v?.typed?.url ??
    v?.programmatic_json?.value ??
    v?.programmatic_json?.fields?.[0]?.value ??
    undefined
  );
}
