/**
 * features/dashboard/explorador/utils/parseManifest.ts
 *
 * Pure functions for parsing and classifying Radix transaction manifests.
 * No React, no hooks — safe to call from any context.
 *
 * Types live in ../types.ts
 */

import { sanitizeText } from '@/utils/sanitize';
import { isConsensusManager } from '@/features/dashboard/utils/entityUtils';
import type { ParsedManifest, AirdropData, OracleUpdate, SourceStyle, FungibleChange, BalanceChanges } from '@/features/dashboard/explorador/types';
import type { TranslationsT } from '@/features/dashboard/types';

// ─────────────────────────────────────────
//  parseManifest
// ─────────────────────────────────────────
/**
 * Extracts all structured data from a raw Radix transaction manifest string.
 * Returns an empty ParsedManifest on falsy input — never throws.
 */
export function parseManifest(manifest: string | undefined): ParsedManifest {
  const empty: ParsedManifest = {
    lockFeeAmount: null, lockFeeAccount: null,
    mainAction: null, nftId: null,
    badgeResource: null, badgeAmount: null, badgeOrigin: null,
    oracleUpdates: [], candiesMatch: null,
  };
  if (!manifest) return empty;

  const lockFeeMatch = manifest.match(/\"lock_fee\"[\s\S]*?Decimal\("([\d.]+)"\)/i);
  const lockFeeAccountMatch = manifest.match(/Address\("(account_[a-z0-9]+)"\)[\s\S]*?"lock_fee"/i);
  const methodCallMatch = manifest.match(/CallMethod[\s\S]*?"((?!lock_fee|deposit_batch|deposit)[a-z_]+)"\s*\)/i);
  const nftIdMatch = manifest.match(/NonFungibleLocalId\("#(\d+)#"\)/i);
  const proofMatch = manifest.match(/"create_proof_of_amount"[\s\S]*?Address\("(resource_[a-z0-9]+)"\)[\s\S]*?Decimal\("([\d.]+)"\)/i);
  const badgeOriginMatch = manifest.match(/Address\("([a-z0-9_]+)"\)[\s\S]*?"create_proof_of_amount"/i);

  // ── Oracle: set_price_batch ──────────────────────────────
  const oracleUpdates: OracleUpdate[] = [];
  if (manifest.includes('"set_price_batch"')) {
    const batchMatch = manifest.match(/"set_price_batch"[\s\S]*?Map(?:<[^>]*>)?\s*\([\s\S]*?\)\s*;/i);
    if (batchMatch) {
      const re = /Tuple\(\s*Address\("(resource_[a-z0-9]+)"\)\s*,\s*Address\("(resource_[a-z0-9]+)"\)\s*\)\s*(?:=>|,)\s*Decimal\("([\d.]+)"\)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(batchMatch[0])) !== null) {
        oracleUpdates.push({ baseToken: m[1], quoteToken: m[2], price: m[3] });
      }
    }
  }

  // ── Airdrop: send_candies ────────────────────────────────
  const candiesMatch = manifest.match(
    /Address\("(component_[a-z0-9]+)"\)[\s\S]*?"send_candies"[\s\S]*?(\d+)u32[\s\S]*?Address\("(account_[a-z0-9]+)"\)[\s\S]*?(\d+)u16/i,
  );

  return {
    lockFeeAmount: lockFeeMatch?.[1] ?? null,
    lockFeeAccount: lockFeeAccountMatch?.[1] ?? null,
    mainAction: methodCallMatch?.[1] ?? null,
    nftId: nftIdMatch?.[1] ?? null,
    badgeResource: proofMatch?.[1] ?? null,
    badgeAmount: proofMatch?.[2] ?? null,
    badgeOrigin: badgeOriginMatch?.[1] ?? null,
    oracleUpdates,
    candiesMatch,
  };
}

// ─────────────────────────────────────────
//  resolveAirdropData
// ─────────────────────────────────────────
/**
 * Merges manifest-parsed candies data with balance_changes to find the
 * resource address credited to the recipient.
 */
export function resolveAirdropData(
  candiesMatch: RegExpMatchArray | null,
  balanceChanges: BalanceChanges | null | undefined,
): AirdropData | null {
  if (!candiesMatch) return null;
  const deposit = balanceChanges?.fungible_balance_changes?.find(
    (c) => { return c.entity_address === candiesMatch![3] && parseFloat(c.balance_change) > 0; },
  );
  return {
    component: candiesMatch[1],
    eventId: candiesMatch[2],
    account: candiesMatch[3],
    amount: candiesMatch[4],
    resource: deposit?.resource_address ?? null,
  };
}

// ─────────────────────────────────────────
//  classifySource
// ─────────────────────────────────────────
/**
 * Determines the visual style tokens for the "Received via:" badge on each
 * transfer row, based on who sent the funds.
 */
export function classifySource(
  senders: FungibleChange[],
  tt?: Partial<TranslationsT['dashboard']['transactions']>,
  options?: { isStakingTx?: boolean },
): SourceStyle {
  const dict = tt;
  const hasCM = senders.some(s => isConsensusManager(s.entity_address));
  const allUserAccounts = senders.length > 0 && senders.every(s => sanitizeText(s.entity_address).startsWith('account_'));

  if (senders.length === 0) return { method: String(dict?.method_minted || 'Minted / Generated'), title: String(dict?.method_minted_title || ''), color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30' };
  if (hasCM) return { method: String(dict?.method_network || 'Network / Protocol'), title: String(dict?.method_network_title || ''), color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30' };
  if (options?.isStakingTx) return { method: String(dict?.method_staking || 'Staking'), title: String(dict?.method_staking_title || ''), color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/30' };
  if (allUserAccounts) return { method: String(dict?.method_user || 'User Transfer'), title: String(dict?.method_user_title || ''), color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-100/10 border-amber-200 dark:border-amber-800/30' };
  return { method: String(dict?.method_smart_contract || 'Smart Contract / Pool'), title: String(dict?.method_smart_contract_title || ''), color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/30' };
}
