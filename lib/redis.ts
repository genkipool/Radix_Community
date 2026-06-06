/**
 * lib/redis.ts
 *
 * Singleton Upstash Redis client to avoid re-initialization overhead
 * across serverless function invocations. The REST-based client is
 * stateless, so a single module-level instance is safe.
 */

import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

let _redis: Redis | null | undefined;

/**
 * Returns a shared Upstash Redis client, or null when env vars are missing.
 * The instance is cached at module scope so warm function invocations
 * skip the constructor entirely.
 */
export function getRedis(): Redis | null {
    if (_redis !== undefined) return _redis;

    try {
        const url = process.env.KV_REST_API_URL;
        const token = process.env.KV_REST_API_TOKEN;

        if (url && token) {
            _redis = new Redis({ url, token });
            return _redis;
        }

        logger.warn('[Redis] Environment variables KV_REST_API_URL / KV_REST_API_TOKEN are missing');
    } catch (e) {
        logger.error({ err: e }, '[Redis] Failed to initialize Upstash Redis client');
    }

    _redis = null;
    return null;
}
