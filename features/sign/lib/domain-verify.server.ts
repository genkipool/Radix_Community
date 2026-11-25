/**
 * Server-side Single Source of Truth for live, custody-free domain verification
 * of a Radix Seal issuer (`/.well-known/radix-seal.json` + DNS TXT).
 *
 * Shared directly by:
 *  - `POST /api/sign/domain-verify`
 *  - `auditSignCollection` (`collection-audit.server.ts` → Web UI + MCP)
 *  - `getOnChainRequestStatus` (`onchain-status.server.ts` → Verify UI + MCP)
 *
 * Security: strict SSRF hardening (HTTPS only, public DNS hostname only,
 * pre-flight DNS resolution rejecting every private/loopback/link-local IP,
 * `redirect: 'manual'`, 3s timeout, and 16 KB response cap).
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { z } from 'zod';
import {
  DNS_TXT_PREFIX,
  buildWellKnownUrl,
  extractPublicDomain,
  matchesDnsTxtRecords,
  matchesWellKnownDocument,
  type DomainMatchTargets,
  type DomainVerificationResult,
} from './domain-verify';
import { RADIX_ACCOUNT_RE, RADIX_RESOURCE_RE } from './network';

const FETCH_TIMEOUT_MS = 3_000;
const MAX_RESPONSE_BYTES = 16_384;

export const domainVerifyInputSchema = z
  .object({
    orgUrl: z.string().min(3).max(300),
    collection: z.string().regex(RADIX_RESOURCE_RE).optional(),
    account: z.string().regex(RADIX_ACCOUNT_RE).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.collection || v.account), {
    message: 'collection or account required',
  });

/** True when an IPv4 or IPv6 literal falls in any private/local/reserved range. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return true; // link-local
    }
    if (lower.startsWith('ff')) return true; // multicast
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateOrReservedIp(mapped[1]);
    return false;
  }
  return true;
}

async function resolvePublicHostSafe(domain: string): Promise<boolean> {
  try {
    const addresses = await dns.lookup(domain, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every((entry) => !isPrivateOrReservedIp(entry.address));
  } catch {
    return false;
  }
}

async function checkWellKnown(
  domain: string,
  targets: DomainMatchTargets,
): Promise<boolean> {
  if (!(await resolvePublicHostSafe(domain))) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(buildWellKnownUrl(domain), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RadixSealVerifier/1.0',
      },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) return false;
    const parsed: unknown = JSON.parse(text);
    return matchesWellKnownDocument(parsed, targets);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function checkDnsTxt(
  domain: string,
  targets: DomainMatchTargets,
): Promise<boolean> {
  try {
    const chunks = await Promise.race([
      dns.resolveTxt(`${DNS_TXT_PREFIX}${domain}`),
      new Promise<string[][]>((_, reject) =>
        setTimeout(() => reject(new Error('dns_timeout')), FETCH_TIMEOUT_MS),
      ),
    ]);
    const records = chunks.map((parts) => parts.join(''));
    return matchesDnsTxtRecords(records, targets);
  } catch {
    return false;
  }
}

/**
 * Verifies whether `orgUrl`'s public domain authorizes `collection` or `account`
 * via `/.well-known/radix-seal.json` or DNS TXT `_radix-seal.<domain>`.
 * Best-effort: never throws on unreachable domains or missing records.
 */
export async function verifyIssuerDomain(input: {
  orgUrl: string | null | undefined;
  collection?: string | null;
  account?: string | null;
}): Promise<DomainVerificationResult> {
  const checkedAt = new Date().toISOString();
  const domain = extractPublicDomain(input.orgUrl);
  if (!domain || (!input.collection && !input.account)) {
    return { verified: false, domain, method: null, checkedAt };
  }

  const targets: DomainMatchTargets = {
    collection: input.collection,
    account: input.account,
  };

  const [wellKnownOk, dnsOk] = await Promise.all([
    checkWellKnown(domain, targets),
    checkDnsTxt(domain, targets),
  ]);

  if (wellKnownOk) {
    return { verified: true, domain, method: 'well-known', checkedAt };
  }
  if (dnsOk) {
    return { verified: true, domain, method: 'dns-txt', checkedAt };
  }
  return { verified: false, domain, method: null, checkedAt };
}
