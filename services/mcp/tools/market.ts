/**
 * services/mcp/tools/market.ts
 *
 * Read-only MCP tools for LSU inspection and crypto market-cap comparisons.
 * Both share their pure logic with the Console UI and use zero Redis commands.
 */

import { z } from 'zod';
import { getCryptoMarkets } from '@/app/api/crypto-markets/route';
import { compareCryptoMarketCap, findCoin } from '@/features/console/lib/crypto-compare';
import { fetchLsuInfo } from '@/features/console/lib/lsu-lookup';
import { fetchAllHolders } from '@/features/console/lib/resource-holders';
import { gatewayPost } from '@/services/gateway/bases';
import { defineMcpTool } from '../registry';
import { cliBanner, cliKeyValues, cliRender, cliSection, cliTable } from '../cli';
import { networkSchema } from './schemas';

export const inspectLsuTool = defineMcpTool({
  name: 'inspect_lsu',
  title: 'Inspect Validator LSU',
  category: 'ledger',
  readOnly: true,
  description:
    'Inspects a Radix validator Liquid Stake Unit (LSU) resource: owning validator, exact XRD/LSU exchange rate, fiat value, total staked XRD, pending unstake, locked owner stake, and optionally top holders.',
  inputSchema: z.object({
    lsuAddress: z.string().min(10).describe('LSU resource address (resource_rdx1… or resource_tdx_2_1…)'),
    network: networkSchema.optional().default('mainnet'),
    includeHolders: z.boolean().optional().default(true),
  }),
  async handler({ lsuAddress, network, includeHolders }) {
    const info = await fetchLsuInfo((ep, body) => gatewayPost(network, ep, body), lsuAddress);
    if (!info) {
      throw new Error(`Resource ${lsuAddress} is not a valid validator LSU on ${network}.`);
    }

    const [markets, holdersRes] = await Promise.all([
      getCryptoMarkets().catch(() => null),
      includeHolders
        ? fetchAllHolders((ep, body) => gatewayPost(network, ep, body), info.lsuAddress, { max: 50 }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const xrdUsd = markets?.coins.find((c) => c.id === 'radix')?.priceUsd ?? null;
    const topHolders = (holdersRes?.holders ?? []).slice(0, 10).map((h) => ({
      address: h.address,
      lsu: Number(h.amount),
      xrdEquivalent: Number(h.amount) * info.xrdPerLsu,
      sharePct: info.totalSupply > 0 ? (Number(h.amount) / info.totalSupply) * 100 : 0,
    }));

    return {
      text: cliRender(
        cliBanner(`LSU · ${info.validatorName}`),
        cliSection('Validator & Exchange Rate'),
        cliKeyValues([
          ['LSU Resource', info.lsuAddress],
          ['Validator', `${info.validatorName} (${info.validatorAddress})`],
          ['Status', `${info.isRegistered ? 'Registered' : 'Unregistered'} · Fee ${info.feePercent.toFixed(2)}%`],
          ['Exchange Rate', `1 LSU = ${info.xrdPerLsu.toFixed(6)} XRD`],
          ['Fiat per LSU', xrdUsd ? `$${(info.xrdPerLsu * xrdUsd).toFixed(5)} USD` : 'N/A'],
          ['Total Staked', `${info.stakeVaultXrd.toLocaleString('en-US', { maximumFractionDigits: 2 })} XRD`],
          ['Total LSU Supply', `${info.totalSupply.toLocaleString('en-US', { maximumFractionDigits: 2 })} LSU`],
          ['Owner Locked', `${info.lockedOwnerXrd.toLocaleString('en-US', { maximumFractionDigits: 2 })} XRD`],
          ['Pending Unstake', `${info.pendingWithdrawXrd.toLocaleString('en-US', { maximumFractionDigits: 2 })} XRD`],
        ]),
        topHolders.length > 0 && cliSection('Top Holders'),
        topHolders.length > 0 && cliTable(
          ['Address', 'LSU', 'XRD Equiv.', 'Share'],
          topHolders.map((h) => [
            h.address,
            h.lsu.toFixed(2),
            h.xrdEquivalent.toFixed(2),
            `${h.sharePct.toFixed(2)}%`,
          ]),
        ),
      ),
      structured: {
        ...info,
        xrdPriceUsd: xrdUsd,
        lsuPriceUsd: xrdUsd ? info.xrdPerLsu * xrdUsd : null,
        totalHolders: holdersRes?.total ?? holdersRes?.holders.length ?? null,
        topHolders,
      },
    };
  },
});

export const compareCryptoMarketCapTool = defineMcpTool({
  name: 'compare_crypto_marketcap',
  title: 'Compare Crypto Market Cap',
  category: 'site',
  readOnly: true,
  description:
    'Compares two cryptocurrencies by market cap (or FDV) and calculates the projected price of the base coin (e.g. Radix XRD) if it reached the market cap of the target coin (e.g. Bitcoin BTC).',
  inputSchema: z.object({
    baseCoin: z.string().optional().default('radix').describe('Base coin id, symbol, or name (default: radix)'),
    targetCoin: z.string().optional().default('bitcoin').describe('Target coin id, symbol, or name (default: bitcoin)'),
    mode: z.enum(['mcap', 'fdv']).optional().default('mcap'),
    amount: z.number().positive().optional().describe('Optional holding amount of baseCoin to project portfolio value'),
  }),
  async handler({ baseCoin, targetCoin, mode, amount }) {
    const payload = await getCryptoMarkets();
    const base = findCoin(payload.coins, baseCoin);
    const target = findCoin(payload.coins, targetCoin);
    if (!base) throw new Error(`Base coin "${baseCoin}" not found in top 100 + Radix.`);
    if (!target) throw new Error(`Target coin "${targetCoin}" not found in top 100 + Radix.`);

    const result = compareCryptoMarketCap(base, target, mode, payload.eurPerUsd, amount);
    if (!result) throw new Error(`Insufficient market cap data to compare ${base.symbol} and ${target.symbol}.`);

    const rows: Array<[string, string]> = [
      ['Mode', mode === 'fdv' ? 'Fully Diluted Valuation (FDV)' : 'Circulating Market Cap'],
      [`${base.symbol} Current Price`, `$${base.priceUsd.toFixed(5)} USD / €${result.currentPriceEur.toFixed(5)} EUR`],
      [`${base.symbol} Projected Price`, `$${result.projectedPriceUsd.toFixed(4)} USD / €${result.projectedPriceEur.toFixed(4)} EUR`],
      ['Multiplier', `${result.multiplier.toFixed(2)}x (${result.percentChange >= 0 ? '+' : ''}${result.percentChange.toFixed(1)}%)`],
      [`${base.symbol} Cap`, `$${Math.round(result.baseCapUsd).toLocaleString('en-US')}`],
      [`${target.symbol} Cap`, `$${Math.round(result.targetCapUsd).toLocaleString('en-US')}`],
    ];
    if (result.holding) {
      rows.push(['Holding Today', `$${result.holding.currentUsd.toFixed(2)} USD`]);
      rows.push(['Holding Projected', `$${result.holding.projectedUsd.toFixed(2)} USD`]);
    }

    return {
      text: cliRender(
        cliBanner(`${base.name} (${base.symbol}) @ ${target.name} (${target.symbol})`),
        cliSection('Projection'),
        cliKeyValues(rows),
      ),
      structured: result as unknown as Record<string, unknown>,
    };
  },
});

export const marketTools = [inspectLsuTool, compareCryptoMarketCapTool];
