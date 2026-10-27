/**
 * Who stands behind an engine caller badge.
 *
 * A role a DEX gives its pools reads "the global caller badge, id [hash]":
 * only calls coming from one component pass. The id is the Blake2b-256 hash
 * of the SBOR-encoded `GlobalCaller::GlobalObject(address)`, so it cannot be
 * read back into an address, only checked against candidates. The package
 * caller badge keeps the package's node id as it is, so that one decodes.
 */
import { blake2b } from 'blakejs';

import { decodeAddressNodeId, encodeAddress } from './address-inspect';
import type { GatewayPost } from './resource-holders';
import { isGlobalCallerBadge, isPackageCallerBadge, type RuleView } from './role-lookup';

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Local id of the global caller badge of `address`, as the Gateway prints it (`[…]`). */
export function globalCallerId(address: string): string | null {
  const node = decodeAddressNodeId(address);
  if (!node) return null;
  // 5c = SBOR payload, 22 00 01 = enum variant 0 with one field, 80 = a Reference.
  return `[${toHex(blake2b(Uint8Array.from([0x5c, 0x22, 0x00, 0x01, 0x80, ...node]), undefined, 32))}]`;
}

/** Network part of a prefix: `rdx`, `tdx_2_`… */
const networkOf = (address: string) => {
  const hrp = address.slice(0, address.lastIndexOf('1'));
  return hrp.slice(hrp.indexOf('_') + 1);
};

/** The package a package-of-direct-caller rule names, decoded from its id. */
export function packageOfCallerRule(rule: RuleView): string | null {
  if (rule.type !== 'nonFungible' || !isPackageCallerBadge(rule.resource)) return null;
  const hex = rule.localId.match(/^\[([0-9a-f]{60})\]$/i)?.[1];
  if (!hex) return null;
  const bytes = Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  return encodeAddress(`package_${networkOf(rule.resource)}`, bytes);
}

/** The candidate whose global caller badge the rule asks for, or null. */
export function matchGlobalCaller(rule: RuleView, candidates: string[]): string | null {
  if (rule.type !== 'nonFungible' || !isGlobalCallerBadge(rule.resource)) return null;
  const want = rule.localId.toLowerCase();
  return candidates.find((c) => globalCallerId(c) === want) ?? null;
}

/**
 * The component behind a global caller rule on `entity`. The component that
 * created the entity is in its first transaction, so that one is checked:
 * the hash confirms the match, nothing is guessed.
 */
export async function findGlobalCaller(post: GatewayPost, entity: string, rules: RuleView[]): Promise<Record<string, string>> {
  const wanted = rules.filter((r) => r.type === 'nonFungible' && isGlobalCallerBadge(r.resource));
  if (!wanted.length) return {};
  const page = await post<{ items?: { affected_global_entities?: string[] }[] }>('/stream/transactions', {
    affected_global_entities_filter: [entity],
    order: 'Asc',
    limit_per_page: 1,
    opt_ins: { affected_global_entities: true },
  });
  const candidates = (page.items?.[0]?.affected_global_entities ?? []).filter((a) => !a.startsWith('resource_'));
  const found: Record<string, string> = {};
  for (const rule of wanted) {
    const match = matchGlobalCaller(rule, candidates);
    if (match && rule.type === 'nonFungible') found[rule.localId] = match;
  }
  return found;
}
