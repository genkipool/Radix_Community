/**
 * The price of the tokens of Radix mainnet, in XRD, and of XRD in USD and EUR:
 * what the account cards multiply a balance by to show its fiat value.
 *
 * Sources, chosen after trying every public one (2026-11):
 * - Astrolescent (`api.astrolescent.com/partner/…/prices`): the aggregator that
 *   routes swaps across every Radix DEX (Ociswap, DefiPlaza, CaviarNine…), so
 *   its price is the one a swap would get. ~900 tokens in one call. Main source.
 * - Ociswap (`api.ociswap.com/tokens`): the tokens with the most liquidity on
 *   Ociswap, used only for those Astrolescent does not list. A thin pool gives
 *   absurd prices, so only tokens with real liquidity are taken.
 * - CoinGecko: XRD in USD and EUR, through services/marketData (the figure the
 *   rest of the dashboard shows), so a token's fiat value matches XRD's.
 * Left out: DefiPlaza (its API lists pairs and TVL, not prices; Astrolescent
 * already routes through it), CaviarNine (no public API answers), CoinGecko
 * per token (one address per call on the free plan, few Radix tokens), and
 * DexScreener and GeckoTerminal (no Radix network).
 *
 * Protection:
 * - Kept in memory a minute; requests that arrive together share one read, so
 *   the sources are asked at most once a minute per instance whatever the
 *   traffic. The route adds a minute of CDN cache on top.
 * - After a failure the sources are not asked again for 30 s.
 * - Every source call has a timeout and a size limit; one source failing does
 *   not stop the other. If all fail, the last good prices are served for up to
 *   an hour, marked stale, instead of an error.
 * - What comes back is validated strictly: only addresses that look like a
 *   Radix resource and finite positive prices pass. No name, icon or other
 *   text from a third party reaches the page.
 * - No Redis: the prices live only in the instance's memory.
 */
import logger from '@/lib/logger';
import { getMarketDataCached } from '@/services/marketData';

export const XRD_RESOURCE = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

const ASTROLESCENT_URL = 'https://api.astrolescent.com/partner/R96v1uADor/prices';
const OCISWAP_URL = 'https://api.ociswap.com/tokens?limit=100&order=liquidity_usd&direction=desc';

const FRESH_MS = 60_000;
const STALE_MAX_MS = 60 * 60_000;
const TIMEOUT_MS = 8_000;
/** Astrolescent answers ~0.9 MB; far above it is not a price list. */
const MAX_BYTES = 8 * 1024 * 1024;
/** Ociswap tokens with less liquidity than this (USD) are left out. */
const MIN_OCISWAP_LIQUIDITY_USD = 1_000;
/** Above this a price in XRD is a broken pool, not a price. */
const MAX_PRICE_XRD = 1e12;

const RESOURCE_RE = /^resource_rdx1[02-9ac-hj-np-z]{54}$/;

export type PriceSource = 'astrolescent' | 'ociswap';

export interface TokenPrices {
    /** When the prices were read, ms since the epoch. */
    updatedAt: number;
    /** The sources failed and these are older than a minute. */
    stale: boolean;
    /** XRD in fiat, from CoinGecko; null when unknown. */
    xrd: { usd: number; eur: number } | null;
    /** Price in XRD of each token, and where it came from. */
    tokens: Record<string, { xrd: number; src: PriceSource }>;
}

const validPrice = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < MAX_PRICE_XRD;

/** A JSON body from a source, with a timeout and a size limit. */
async function getJson(url: string): Promise<unknown> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
        headers: { accept: 'application/json' },
        redirect: 'error',
    });
    if (!res.ok) throw new Error(`${new URL(url).host}: ${res.status}`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) throw new Error(`${new URL(url).host}: too large`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error(`${new URL(url).host}: too large`);
    return JSON.parse(text);
}

/** Astrolescent: `{ [resource]: { tokenPriceXRD, … } }`. */
export function parseAstrolescent(body: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) return out;
    for (const [address, row] of Object.entries(body as Record<string, unknown>)) {
        if (!RESOURCE_RE.test(address) || !row || typeof row !== 'object') continue;
        const price = (row as { tokenPriceXRD?: unknown }).tokenPriceXRD;
        if (validPrice(price)) out[address] = price;
    }
    return out;
}

/** Ociswap: `{ data: [{ address, price: { xrd: { now } }, volume, market_cap… }] }`, by liquidity. */
export function parseOciswap(body: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    const rows = (body as { data?: unknown })?.data;
    if (!Array.isArray(rows)) return out;
    for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const r = row as { address?: unknown; price?: { xrd?: { now?: unknown } }; liquidity?: { usd?: { now?: unknown } } };
        if (typeof r.address !== 'string' || !RESOURCE_RE.test(r.address)) continue;
        // The list comes sorted by liquidity; when it says how much, a thin pool is left out.
        const liquidity = Number(r.liquidity?.usd?.now ?? NaN);
        if (Number.isFinite(liquidity) && liquidity < MIN_OCISWAP_LIQUIDITY_USD) continue;
        const price = Number(r.price?.xrd?.now);
        if (validPrice(price)) out[r.address] = price;
    }
    return out;
}

/** Both sources merged: Astrolescent first, Ociswap only for what it lacks. XRD is 1. */
export function mergePrices(astro: Record<string, number>, oci: Record<string, number>): TokenPrices['tokens'] {
    const tokens: TokenPrices['tokens'] = {};
    for (const [a, xrd] of Object.entries(oci)) tokens[a] = { xrd, src: 'ociswap' };
    for (const [a, xrd] of Object.entries(astro)) tokens[a] = { xrd, src: 'astrolescent' };
    tokens[XRD_RESOURCE] = { xrd: 1, src: tokens[XRD_RESOURCE]?.src ?? 'astrolescent' };
    return tokens;
}

async function readPrices(): Promise<TokenPrices | null> {
    const [astro, oci, market] = await Promise.allSettled([
        getJson(ASTROLESCENT_URL).then(parseAstrolescent),
        getJson(OCISWAP_URL).then(parseOciswap),
        getMarketDataCached(),
    ]);
    if (astro.status === 'rejected') logger.warn({ err: astro.reason }, '[TokenPrices] Astrolescent failed');
    if (oci.status === 'rejected') logger.warn({ err: oci.reason }, '[TokenPrices] Ociswap failed');
    const a = astro.status === 'fulfilled' ? astro.value : {};
    const o = oci.status === 'fulfilled' ? oci.value : {};
    if (Object.keys(a).length === 0 && Object.keys(o).length === 0) return null;
    const m = market.status === 'fulfilled' ? market.value : null;
    const xrd = m && m.priceUsd > 0 && m.priceEur > 0 ? { usd: m.priceUsd, eur: m.priceEur } : null;
    return { updatedAt: Date.now(), stale: false, xrd, tokens: mergePrices(a, o) };
}

/** After a failed read the sources are left alone this long, so an outage does not turn every request into a retry. */
const RETRY_MS = 30_000;

let last: TokenPrices | null = null;
let failedAt = 0;
let inflight: Promise<TokenPrices | null> | null = null;

const staleCopy = (): TokenPrices | null =>
    last && Date.now() - last.updatedAt < STALE_MAX_MS ? { ...last, stale: true } : null;

/** The prices, read at most once a minute per instance; the last good ones (up to an hour) when the sources fail. */
export async function getTokenPrices(): Promise<TokenPrices | null> {
    if (last && Date.now() - last.updatedAt < FRESH_MS) return last;
    if (!inflight && Date.now() - failedAt < RETRY_MS) return staleCopy();
    if (!inflight) {
        inflight = readPrices()
            .catch((err) => {
                logger.warn({ err }, '[TokenPrices] read failed');
                return null;
            })
            .then((fresh) => {
                if (fresh) last = fresh;
                else failedAt = Date.now();
                return fresh;
            })
            .finally(() => { inflight = null; });
    }
    const fresh = await inflight;
    return fresh ?? staleCopy();
}
