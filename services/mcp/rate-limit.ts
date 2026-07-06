/**
 * services/mcp/rate-limit.ts
 *
 * Minimal in-memory, per-IP fixed-window rate limiter for the public MCP
 * endpoint. That endpoint is unauthenticated and proxies Gateway calls and runs
 * the Radix Engine Toolkit (CPU-heavy: SBOR decode, validation, preview), so a
 * basic cap protects cost and availability against abuse.
 *
 * In-memory means the window is per server instance (best-effort on serverless)
 * — enough to blunt a single abusive caller without extra infrastructure.
 */

const WINDOW_MS = 60_000;
/** Max requests per IP per window. Generous enough for real agent bursts. */
const MAX_REQUESTS = 300;
/** Cap the map size so it can never grow unbounded under many distinct IPs. */
const MAX_TRACKED_IPS = 10_000;

interface Window {
  count: number;
  resetAt: number;
}

const hits = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Records a hit for `ip` and reports whether it is within the window budget. */
export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const entry = hits.get(ip);

  if (!entry || now >= entry.resetAt) {
    if (hits.size > MAX_TRACKED_IPS) {
      for (const [key, value] of hits) if (now >= value.resetAt) hits.delete(key);
    }
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Extracts the caller IP from proxy headers (Vercel/most proxies set these). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
