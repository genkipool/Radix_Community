/**
 * Pure, isomorphic Single Source of Truth for Radix Seal custody-free domain
 * verification (`/.well-known/radix-seal.json` and DNS TXT `_radix-seal.<host>`).
 *
 * Safe to import from both browser UI (snippets, URL formatting, preview) and
 * server routes / MCP (`domain-verify.server.ts`).
 */

export type DomainVerificationMethod = 'well-known' | 'dns-txt';

export interface DomainVerificationResult {
  verified: boolean;
  /** Normalized public domain extracted from `org_url`, or null if invalid/absent. */
  domain: string | null;
  /** Which proof matched (`well-known` or `dns-txt`), or null when unverified. */
  method: DomainVerificationMethod | null;
  /** ISO-8601 UTC timestamp of when the check ran. */
  checkedAt: string;
}

export interface DomainMatchTargets {
  collection?: string | null;
  account?: string | null;
}

export const WELL_KNOWN_PATH = '/.well-known/radix-seal.json';
export const DNS_TXT_PREFIX = '_radix-seal.';

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.localdomain',
  '.lan',
  '.home',
  '.arpa',
  '.corp',
];

/**
 * Extracts a safe, normalized public DNS hostname from an issuer's `org_url`
 * (or bare domain), rejecting non-HTTPS URLs, IP literals, non-standard ports,
 * credentials, and private/local hostnames.
 */
export function extractPublicDomain(
  rawUrl: string | null | undefined,
): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.includes(':')) return null;
  if (IPV4_RE.test(host)) return null;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return null;
  if (!HOSTNAME_RE.test(host)) return null;

  return host;
}

/** Canonical HTTPS URL where an issuer publishes its Radix Seal declaration. */
export function buildWellKnownUrl(domain: string): string {
  return `https://${domain}${WELL_KNOWN_PATH}`;
}

/** Canonical JSON snippet an issuer uploads to `/.well-known/radix-seal.json`. */
export function buildWellKnownSnippet(
  collection: string,
  account?: string | null,
): string {
  const payload: Record<string, unknown> = {
    v: 1,
    collections: [collection],
    ...(account ? { accounts: [account] } : {}),
  };
  return JSON.stringify(payload, null, 2);
}

/** Canonical DNS TXT host & value an issuer publishes in their DNS zone. */
export function buildDnsTxtRecord(
  domain: string,
  collection: string,
): { host: string; value: string } {
  return {
    host: `${DNS_TXT_PREFIX}${domain}`,
    value: `v=radix-seal1 collection=${collection}`,
  };
}

function normalizeList(single: unknown, list: unknown): string[] {
  const out: string[] = [];
  if (typeof single === 'string' && single.trim()) out.push(single.trim());
  if (Array.isArray(list)) {
    for (const item of list) {
      if (typeof item === 'string' && item.trim()) out.push(item.trim());
    }
  }
  return out;
}

/**
 * Evaluates a parsed `/.well-known/radix-seal.json` payload against the
 * collection (preferred) or issuing account.
 */
export function matchesWellKnownDocument(
  data: unknown,
  targets: DomainMatchTargets,
): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  if (obj.v !== undefined && obj.v !== 1) return false;

  const collections = normalizeList(obj.collection, obj.collections);
  const accounts = normalizeList(obj.account, obj.accounts);

  if (targets.collection && collections.includes(targets.collection.trim())) {
    return true;
  }
  if (targets.account && accounts.includes(targets.account.trim())) {
    return true;
  }
  return false;
}

/**
 * Evaluates DNS TXT records returned for `_radix-seal.<domain>`.
 * Accepts space- or semicolon-separated `key=value` tokens prefixed with
 * `v=radix-seal1`, e.g. `v=radix-seal1 collection=resource_rdx1...`.
 */
export function matchesDnsTxtRecords(
  records: string[],
  targets: DomainMatchTargets,
): boolean {
  const wantedCol = targets.collection?.trim() || '';
  const wantedAcc = targets.account?.trim() || '';
  if (!wantedCol && !wantedAcc) return false;

  for (const raw of records) {
    const tokens = raw
      .split(/[\s;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tokens.includes('v=radix-seal1')) continue;
    for (const token of tokens) {
      if (wantedCol && token === `collection=${wantedCol}`) return true;
      if (wantedAcc && token === `account=${wantedAcc}`) return true;
    }
  }
  return false;
}
