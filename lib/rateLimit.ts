/**
 * lib/rateLimit.ts
 *
 * Per-IP, fixed-window rate limits for the public endpoints, one policy per
 * kind of endpoint so a busy MCP client does not use up someone's login.
 *
 * Counted in Upstash Redis when it is configured, so the window is shared by
 * every serverless instance; in memory otherwise (one instance only, which
 * still blunts a single abusive caller). A Redis failure falls back to memory
 * rather than letting everything through.
 */

import { getRedis } from '@/lib/redis';
import logger from '@/lib/logger';

export interface RateLimitPolicy {
    /** Names the counter, so policies never share one. */
    name: string;
    /** Hits allowed per window. */
    limit: number;
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

const MINUTE = 60_000;

export const RATE_LIMITS = {
    /** The MCP endpoint: every JSON-RPC message counts, batched or not. */
    mcp: { name: 'mcp', limit: 300, windowMs: MINUTE },
    /** Login, session update and logout; each challenge is a database row. */
    auth: { name: 'auth', limit: 20, windowMs: MINUTE },
    /** Radix Engine Toolkit endpoints: CPU-heavy decoding and validation. */
    engine: { name: 'engine', limit: 60, windowMs: MINUTE },
    /** Signing, timestamps and verification. */
    sign: { name: 'sign', limit: 120, windowMs: MINUTE },
    /** Endpoints that refresh shared caches on a reader's request. */
    cacheRefresh: { name: 'cache-refresh', limit: 10, windowMs: MINUTE },
    /** Forms that send email to the team. */
    contact: { name: 'contact', limit: 5, windowMs: 60 * MINUTE },
} as const satisfies Record<string, RateLimitPolicy>;

/** Cap on the in-memory map, so it can never grow unbounded under many IPs. */
const MAX_TRACKED_KEYS = 10_000;
const memory = new Map<string, { count: number; resetAt: number }>();

/** Records `cost` hits for `ip` under `policy` and says whether they are within its window. */
export async function rateLimit(
    policy: RateLimitPolicy,
    ip: string,
    cost = 1,
    now: number = Date.now(),
): Promise<RateLimitResult> {
    const windowStart = now - (now % policy.windowMs);
    const resetAt = windowStart + policy.windowMs;
    const key = `rl:${policy.name}:${ip}:${windowStart}`;
    const count = (await countInRedis(key, cost, policy.windowMs)) ?? countInMemory(key, cost, resetAt, now);
    return count <= policy.limit
        ? { allowed: true, retryAfterSeconds: 0 }
        : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
}

async function countInRedis(key: string, cost: number, windowMs: number): Promise<number | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
        const [count] = await redis.pipeline().incrby(key, cost).pexpire(key, windowMs).exec<[number, number]>();
        return count;
    } catch (error) {
        logger.warn({ err: error }, '[RateLimit] Redis unavailable; counting in memory');
        return null;
    }
}

function countInMemory(key: string, cost: number, resetAt: number, now: number): number {
    if (memory.size > MAX_TRACKED_KEYS) {
        for (const [k, v] of memory) if (now >= v.resetAt) memory.delete(k);
    }
    const entry = memory.get(key) ?? { count: 0, resetAt };
    entry.count += cost;
    memory.set(key, entry);
    return entry.count;
}

/** The caller's IP, as the hosting proxy reports it. */
export function clientIp(headers: Headers): string {
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return headers.get('x-real-ip')?.trim() || 'unknown';
}

/** A plain 429 answer for JSON endpoints. */
export function tooManyRequests({ retryAfterSeconds }: RateLimitResult): Response {
    return Response.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
}
