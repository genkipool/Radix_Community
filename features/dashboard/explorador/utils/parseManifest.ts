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
import type { ParsedManifest, AirdropData, OracleUpdate, OracleCall, SourceStyle, FungibleChange, BalanceChanges } from '@/features/dashboard/explorador/types';
import type { TranslationsT } from '@/features/dashboard/types';

// ─────────────────────────────────────────
//  Statement helpers
// ─────────────────────────────────────────
/** Methods that only move fees, proofs or funds around: never "the" action of a transaction. */
const PLUMBING_METHOD = /^(lock_fee|lock_contingent_fee|create_proof_of_\w+|withdraw\w*|deposit\w*|try_deposit\w*)$/;

interface MethodCall {
  /** The entity the method is called on. */
  target: string;
  method: string;
  /** The whole instruction, arguments included. */
  body: string;
}

/**
 * The CALL_METHOD instructions of a manifest, in order. Instructions end at a
 * `;` outside a string; address and decimal literals never contain one.
 */
function methodCalls(manifest: string): MethodCall[] {
  return manifest
    .split(/;\s*(?=[A-Z_]+\b|$)/)
    .map((body) => body.match(/^\s*CALL_METHOD\s+Address\("([a-z0-9_]+)"\)\s+"([a-z0-9_]+)"/i) ? body : null)
    .filter((body): body is string => body !== null)
    .map((body) => {
      const [, target, method] = body.match(/^\s*CALL_METHOD\s+Address\("([a-z0-9_]+)"\)\s+"([a-z0-9_]+)"/i)!;
      return { target, method, body };
    });
}

/**
 * Price updates passed as a map from resource to price, as in
 * `update_prices(Map<Address, Decimal>(Address("resource_…") => Decimal("…"), …))`.
 * Prices carry no unit of their own: when the call prices exactly one resource
 * at 1, that resource is the unit the rest are quoted in.
 */
function parsePriceMap(call: MethodCall): { updates: OracleUpdate[]; call: OracleCall } | null {
  if (!/price/i.test(call.method)) return null;
  const re = /Address\("(resource_[a-z0-9_]+)"\)\s*=>\s*Decimal\("([\d.]+)"\)/gi;
  const pairs: [string, string][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(call.body)) !== null) pairs.push([m[1], m[2]]);
  if (pairs.length === 0) return null;

  const units = pairs.filter(([, price]) => Number(price) === 1);
  const reference = units.length === 1 ? units[0][0] : null;
  return {
    updates: pairs
      .filter(([resource]) => resource !== reference)
      .map(([baseToken, price]) => ({ baseToken, quoteToken: reference ?? '', price })),
    call: { component: call.target, method: call.method, reference },
  };
}

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
    badgeResource: null, badgeAmount: null, badgeOrigin: null, badgeNftIds: [],
    oracleUpdates: [], oracleCall: null, candiesMatch: null,
  };
  if (!manifest) return empty;

  const lockFeeMatch = manifest.match(/\"lock_fee\"[\s\S]*?Decimal\("([\d.]+)"\)/i);
  const lockFeeAccountMatch = manifest.match(/Address\("(account_[a-z0-9]+)"\)[\s\S]*?"lock_fee"/i);
  const methodCallMatch = manifest.match(/CallMethod[\s\S]*?"((?!lock_fee|deposit_batch|deposit)[a-z_]+)"\s*\)/i);
  const nftIdMatch = manifest.match(/NonFungibleLocalId\("#(\d+)#"\)/i);
  const proofMatch = manifest.match(/"create_proof_of_amount"[\s\S]*?Address\("(resource_[a-z0-9]+)"\)[\s\S]*?Decimal\("([\d.]+)"\)/i);
  const badgeOriginMatch = manifest.match(/Address\("([a-z0-9_]+)"\)[\s\S]*?"create_proof_of_amount"/i);

  const calls = methodCalls(manifest);
  const mainCall = calls.find((c) => !PLUMBING_METHOD.test(c.method));
  // A badge shown by its local ids: the proof names the resource and the ids.
  const nftProof = calls.find((c) => c.method === 'create_proof_of_non_fungibles');
  const nftProofResource = nftProof?.body.match(/Address\("(resource_[a-z0-9_]+)"\)/i)?.[1] ?? null;
  const nftProofIds = nftProof ? [...nftProof.body.matchAll(/NonFungibleLocalId\("([^"]+)"\)/g)].map((id) => id[1]) : [];
  // The NFT a transaction acts on, not the one it shows as a badge.
  const actedNftId = calls
    .filter((c) => !c.method.startsWith('create_proof_of_'))
    .map((c) => c.body.match(/NonFungibleLocalId\("#(\d+)#"\)/i)?.[1])
    .find(Boolean);

  // ── Oracle: update_prices(Map<Address, Decimal>) ──────────
  const priceMap = calls.map(parsePriceMap).find(Boolean) ?? null;

  // ── Oracle: set_price_batch ──────────────────────────────
  const oracleUpdates: OracleUpdate[] = priceMap?.updates ?? [];
  if (!priceMap && manifest.includes('"set_price_batch"')) {
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
    mainAction: mainCall?.method ?? methodCallMatch?.[1] ?? null,
    nftId: calls.length ? actedNftId ?? null : nftIdMatch?.[1] ?? null,
    badgeResource: proofMatch?.[1] ?? nftProofResource,
    badgeAmount: proofMatch?.[2] ?? (nftProofIds.length ? String(nftProofIds.length) : null),
    badgeOrigin: badgeOriginMatch?.[1] ?? nftProof?.target ?? null,
    badgeNftIds: proofMatch ? [] : nftProofIds,
    oracleUpdates,
    oracleCall: priceMap?.call ?? null,
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
