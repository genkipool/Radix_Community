/**
 * services/gateway/client.ts
 *
 * Radix Gateway API client setup, authentication, and rate-limit resilience
 * primitives. Shared by all other gateway modules.
 */

import { GatewayApiClient, RadixNetwork } from '@radixdlt/babylon-gateway-api-sdk';

// ── Auth ──────────────────────────────────────────────────────────────────────
const AUTH_CONFIG = {
  username: process.env.GATEWAY_AUTH_USER ?? '',
  password: process.env.GATEWAY_AUTH_PASS ?? '',
};

const getAuthHeader = (): Record<string, string> => {
  if (!AUTH_CONFIG.username || !AUTH_CONFIG.password) return {};
  const creds = Buffer.from(`${AUTH_CONFIG.username}:${AUTH_CONFIG.password}`).toString('base64');
  return { Authorization: `Basic ${creds}` };
};

// ── Gateway instances ─────────────────────────────────────────────────────────
const gatewayMainnet = GatewayApiClient.initialize({
  networkId: RadixNetwork.Mainnet,
  applicationName: 'Radix Dashboard',
  applicationVersion: '1.0.0',
  applicationDappDefinitionAddress:
    'account_rdx12y4l35lh2543nfa9pyyzvsh64ssu0dv6fq20gg8suslwmjvkylejgj',
  headers: getAuthHeader(),
});

const gatewayStokenet = GatewayApiClient.initialize({
  networkId: RadixNetwork.Stokenet,
  applicationName: 'Radix Dashboard',
  applicationVersion: '1.0.0',
  applicationDappDefinitionAddress:
    'account_tdx_2_12y6l2xeqhmscl95huz7ru72a24esmsn84j7qew4gux0a4fptyspyd7',
  headers: getAuthHeader(),
});

export type Network = 'mainnet' | 'stokenet';

export const getGateway = (network: Network = 'mainnet') =>
  network === 'stokenet' ? gatewayStokenet : gatewayMainnet;


// ── Rate-limit resilience ─────────────────────────────────────────────────────
const RETRY_MAX = 3;
const RETRY_BASE_MS = 400;

function _status(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { status?: number; statusCode?: number; response?: { status?: number } };
  return e.status ?? e.statusCode ?? e.response?.status ?? null;
}

/**
 * Whether an error is worth asking again about.
 *
 * Rate limits and 5xx are the Gateway having a bad second, and so is a socket
 * that died mid-request; all three answer differently a moment later. A 4xx is
 * the Gateway telling us the request itself is wrong, and repeating it only
 * adds load to a service that already said no.
 *
 * This used to cover 429 alone, which left the most common failure of a busy
 * mainnet — a 502/504 from the edge, or a dropped connection — with no second
 * attempt at all.
 */
function _isTransient(err: unknown): boolean {
  const status = _status(err);
  if (status === 429 || (status !== null && status >= 500)) return true;
  if (status !== null) return false;
  const message = (err as { message?: string })?.message;
  if (typeof message !== 'string') return false;
  if (message.includes('429')) return true;
  return /fetch failed|network|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN|aborted|timeout/i.test(
    message,
  );
}

function _getRetryAfterMs(err: unknown): number | null {
  const e = err as { headers?: Record<string, string>; response?: { headers?: Record<string, string> } };
  const raw =
    e?.headers?.['retry-after'] ??
    e?.response?.headers?.['retry-after'] ??
    null;
  if (!raw) return null;
  const seconds = parseFloat(raw);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(raw);
  if (!isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = RETRY_MAX,
  attempt = 0
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!_isTransient(err) || attempt >= maxRetries) throw err;
    // A rate limit says when to come back and that is respected; everything
    // else backs off from 400ms, which outlasts a blip without stalling a page.
    const ms = _getRetryAfterMs(err) ?? RETRY_BASE_MS * 2 ** attempt;
    await new Promise(r => setTimeout(r, ms));
    return withRetry(fn, maxRetries, attempt + 1);
  }
}

export async function runWithLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker(): Promise<void> {
    if (next >= tasks.length) return;
    const i = next++;
    results[i] = await tasks[i]();
    await worker();
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

export async function runInBatches<TItem, TResult>(
  items: TItem[],
  fn: (item: TItem, index: number) => Promise<TResult>,
  limit: number,
): Promise<TResult[]> {
  return runWithLimit(items.map((item, i) => () => fn(item, i)), limit);
}

export const CONCURRENCY = {
  SNAPSHOTS: 5,
  ENTITY: 6,
  OWNERS: 6,
  HOLDERS: 3,
  GEO: 8,
} as const;
