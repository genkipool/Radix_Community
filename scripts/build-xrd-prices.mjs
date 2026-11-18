/**
 * scripts/build-xrd-prices.mjs
 *
 * Builds `services/data/xrd-daily-prices.json`: historical daily XRD closing
 * prices in USD and EUR (`"YYYY-MM-DD": [usd, eur]`), from Olympia launch
 * (2021-07-26) to today.
 *
 * Sources (all public, no API key):
 * - Bitfinex daily candles (`tXRDUSD`, and `tEXRD:USD` for the first month
 *   of Olympia before XRD listed on Bitfinex, since eXRD was 1:1 with XRD).
 * - Frankfurter (ECB) daily USD→EUR FX rates for historical USD→EUR conversion.
 * - CoinGecko 365-day daily USD & EUR series overlaid on top for the last year,
 *   so recent prices match the dashboard's CoinGecko current price seamlessly.
 *
 * Run: `node scripts/build-xrd-prices.mjs`
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../services/data/xrd-daily-prices.json');

const toDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const roundPrice = (n) => Number(n.toPrecision(6));

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchBitfinexCandles(symbol, startMs) {
  const byDay = new Map();
  let cursor = startMs;
  for (let page = 0; page < 10; page++) {
    const url = `https://api-pub.bitfinex.com/v2/candles/trade:1D:${symbol}/hist?limit=1000&sort=1&start=${cursor}`;
    const rows = await fetchJson(url);
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      // Bitfinex candle: [MTS, OPEN, CLOSE, HIGH, LOW, VOLUME]
      const [mts, , close] = row;
      if (typeof mts === 'number' && typeof close === 'number' && Number.isFinite(close) && close > 0) {
        byDay.set(toDay(mts), close);
      }
    }
    if (rows.length < 1000) break;
    const lastMts = rows[rows.length - 1][0];
    if (lastMts <= cursor) break;
    cursor = lastMts + 86_400_000;
    await new Promise((r) => setTimeout(r, 300));
  }
  return byDay;
}

async function fetchEurRates(fromDay, toDayStr) {
  const url = `https://api.frankfurter.app/${fromDay}..${toDayStr}?from=USD&to=EUR`;
  const data = await fetchJson(url);
  return data.rates ?? {};
}

async function fetchCoinGeckoDaily(currency) {
  const url = `https://api.coingecko.com/api/v3/coins/radix/market_chart?vs_currency=${currency}&days=365&interval=daily`;
  const data = await fetchJson(url);
  const byDay = new Map();
  for (const [mts, price] of data.prices ?? []) {
    if (typeof mts === 'number' && typeof price === 'number' && Number.isFinite(price) && price > 0) {
      byDay.set(toDay(mts), price);
    }
  }
  return byDay;
}

async function main() {
  const startDay = '2021-07-20';
  const today = new Date().toISOString().slice(0, 10);
  const startMs = Date.parse(`${startDay}T00:00:00Z`);

  console.log('Fetching Bitfinex tXRDUSD...');
  const xrdUsd = await fetchBitfinexCandles('tXRDUSD', startMs);
  console.log(`  tXRDUSD: ${xrdUsd.size} days`);

  console.log('Fetching Bitfinex tEXRD:USD (for pre-listing Olympia days)...');
  let exrdUsd = new Map();
  try {
    exrdUsd = await fetchBitfinexCandles('tEXRD:USD', startMs);
    console.log(`  tEXRD:USD: ${exrdUsd.size} days`);
  } catch (err) {
    console.warn('  tEXRD:USD unavailable:', err.message);
  }

  console.log('Fetching Frankfurter USD->EUR rates...');
  const fxRates = await fetchEurRates(startDay, today);
  console.log(`  FX days: ${Object.keys(fxRates).length}`);

  console.log('Fetching CoinGecko 365d USD & EUR...');
  const cgUsd = await fetchCoinGeckoDaily('usd');
  await new Promise((r) => setTimeout(r, 1200));
  const cgEur = await fetchCoinGeckoDaily('eur');
  console.log(`  CoinGecko USD: ${cgUsd.size} days, EUR: ${cgEur.size} days`);

  // Build continuous day-by-day map from 2021-07-26 to today, carrying forward
  // weekend FX rates and any occasional missing exchange day.
  const out = {};
  let lastFx = 0.85;
  for (const d of Object.keys(fxRates).sort()) {
    if (d <= '2021-07-26' && typeof fxRates[d]?.EUR === 'number') lastFx = fxRates[d].EUR;
  }

  let lastUsd = null;
  let lastEur = null;
  const start = Date.parse('2021-07-26T00:00:00Z');
  const end = Date.parse(`${today}T00:00:00Z`);

  for (let ms = start; ms <= end; ms += 86_400_000) {
    const day = toDay(ms);
    if (typeof fxRates[day]?.EUR === 'number') lastFx = fxRates[day].EUR;

    const uCg = cgUsd.get(day);
    const eCg = cgEur.get(day);
    if (uCg && eCg) {
      lastUsd = uCg;
      lastEur = eCg;
      out[day] = [roundPrice(uCg), roundPrice(eCg)];
      continue;
    }

    const u = xrdUsd.get(day) ?? exrdUsd.get(day) ?? uCg ?? lastUsd;
    if (u) {
      lastUsd = u;
      lastEur = eCg ?? u * lastFx;
      out[day] = [roundPrice(lastUsd), roundPrice(lastEur)];
    }
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out));
  const keys = Object.keys(out);
  console.log(`\nWrote ${keys.length} days (${keys[0]} .. ${keys[keys.length - 1]}) to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
