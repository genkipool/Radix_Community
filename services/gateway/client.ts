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

export const getAuthHeader = (): Record<string, string> => {
  if (!AUTH_CONFIG.username || !AUTH_CONFIG.password) return {};
  const creds = Buffer.from(`${AUTH_CONFIG.username}:${AUTH_CONFIG.password}`).toString('base64');
  return { Authorization: `Basic ${creds}` };
};

// ── Gateway instances ─────────────────────────────────────────────────────────
export const gatewayMainnet = GatewayApiClient.initialize({
  networkId: RadixNetwork.Mainnet,
  applicationName: 'Radix Dashboard',
  applicationVersion: '1.0.0',
  applicationDappDefinitionAddress:
    'account_rdx12y4l35lh2543nfa9pyyzvsh64ssu0dv6fq20gg8suslwmjvkylejgj',
  headers: getAuthHeader(),
});

export const gatewayStokenet = GatewayApiClient.initialize({
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
const RETRY_BASE_MS = 2_000;

function _is429(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; statusCode?: number; message?: string; response?: { status?: number } };
  if (e.status === 429 || e.statusCode === 429) return true;
  if (typeof e.message === 'string' && e.message.includes('429')) return true;
  if (e.response?.status === 429) return true;
  return false;
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
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!_is429(err) || attempt === maxRetries) throw err;
      const ms = _getRetryAfterMs(err) ?? RETRY_BASE_MS * 2 ** attempt;
      await new Promise(r => setTimeout(r, ms));
    }
  }
  throw lastErr;
}

export async function runWithLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
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
