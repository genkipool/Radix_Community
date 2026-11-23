/**
 * services/mcp/tools/atomicSwap.ts
 *
 * MCP manifest-preparation tool for trustless P2P Atomic OTC Swaps
 * (both Subintent V2 pre-authorization and Direct V1 atomic swap),
 * supporting single or multiple accounts and single or multiple resources on both sides.
 */

import Big from 'big.js';
import { z } from 'zod';
import {
  buildDirectAtomicSwapManifest,
  buildMakerSubintentManifest,
  type PerAccountHoldingsMap,
  type SwapAssetInput,
} from '@/features/console/lib/atomic-swap';
import { gatewayPost } from '@/services/gateway/bases';
import { defineMcpTool } from '../registry';
import { cliBanner, cliCode, cliKeyValues, cliRender, cliSection } from '../cli';

const accountSchema = z.string().startsWith('account_');
const accountInputSchema = z.union([accountSchema, z.array(accountSchema).min(1)]);

const assetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('fungible'),
    resourceAddress: z.string().startsWith('resource_'),
    amount: z.string().min(1),
  }),
  z.object({
    kind: z.literal('nft'),
    resourceAddress: z.string().startsWith('resource_'),
    ids: z.array(z.string().min(1)).min(1),
  }),
]);

const assetInputSchema = z.union([assetSchema, z.array(assetSchema).min(1)]);

const byAccountSchema = z.record(
  z.string(),
  z.object({
    fungibles: z
      .array(z.object({ resourceAddress: z.string().startsWith('resource_'), amount: z.string() }))
      .default([]),
    nonFungibles: z
      .array(z.object({ resourceAddress: z.string().startsWith('resource_'), ids: z.array(z.string()) }))
      .default([]),
  }),
);

interface GatewayFungibleItem {
  resource_address: string;
  vaults?: { items?: Array<{ amount?: string }> };
}

interface GatewayNonFungibleItem {
  resource_address: string;
  vaults?: { items?: Array<{ items?: string[] }> };
}

interface GatewayDetailsItem {
  address: string;
  fungible_resources?: { items?: GatewayFungibleItem[]; next_cursor?: string | null };
  non_fungible_resources?: { items?: GatewayNonFungibleItem[]; next_cursor?: string | null };
}

function detectGatewayNetwork(accounts: string[]): 'mainnet' | 'stokenet' | null {
  if (accounts.some((a) => a.startsWith('account_tdx_2_'))) return 'stokenet';
  if (accounts.some((a) => a.startsWith('account_rdx1'))) return 'mainnet';
  return null;
}

/**
 * Fetches on-ledger per-account holdings from Radix Gateway so multi-account
 * swaps automatically withdraw each asset from whichever selected account(s) hold it.
 */
async function fetchPerAccountHoldings(accounts: string[]): Promise<PerAccountHoldingsMap | undefined> {
  const network = detectGatewayNetwork(accounts);
  if (!network || accounts.length <= 1) return undefined;

  try {
    const res = await gatewayPost<{ items?: GatewayDetailsItem[] }>(network, '/state/entity/details', {
      addresses: accounts,
      aggregation_level: 'Vault',
      opt_ins: { non_fungible_include_nfids: true },
    });
    const map: PerAccountHoldingsMap = {};
    for (const item of res.items ?? []) {
      const fItems = [...(item.fungible_resources?.items ?? [])];
      let fCursor = item.fungible_resources?.next_cursor ?? null;
      while (fCursor) {
        const page = await gatewayPost<{ items?: GatewayFungibleItem[]; next_cursor?: string | null }>(
          network,
          '/state/entity/page/fungibles/',
          { address: item.address, aggregation_level: 'Vault', cursor: fCursor },
        );
        if (page.items?.length) fItems.push(...page.items);
        fCursor = page.next_cursor ?? null;
      }

      const nfItems = [...(item.non_fungible_resources?.items ?? [])];
      let nfCursor = item.non_fungible_resources?.next_cursor ?? null;
      while (nfCursor) {
        const page = await gatewayPost<{ items?: GatewayNonFungibleItem[]; next_cursor?: string | null }>(
          network,
          '/state/entity/page/non-fungibles/',
          {
            address: item.address,
            aggregation_level: 'Vault',
            cursor: nfCursor,
            opt_ins: { non_fungible_include_nfids: true },
          },
        );
        if (page.items?.length) nfItems.push(...page.items);
        nfCursor = page.next_cursor ?? null;
      }

      const fungibles: Array<{ resourceAddress: string; amount: string }> = [];
      for (const f of fItems) {
        let total = new Big(0);
        for (const v of f.vaults?.items ?? []) {
          if (v.amount) total = total.plus(v.amount);
        }
        if (total.gt(0)) {
          fungibles.push({ resourceAddress: f.resource_address, amount: total.toFixed() });
        }
      }

      const nonFungibles: Array<{ resourceAddress: string; ids: string[] }> = [];
      for (const nf of nfItems) {
        const ids = (nf.vaults?.items ?? []).flatMap((v) => v.items ?? []);
        if (ids.length > 0) {
          nonFungibles.push({ resourceAddress: nf.resource_address, ids });
        }
      }

      map[item.address] = { fungibles, nonFungibles };
    }
    return map;
  } catch {
    return undefined;
  }
}

export const prepareAtomicSwapTool = defineMcpTool({
  name: 'prepare_atomic_swap',
  title: 'Prepare P2P Atomic OTC Swap',
  category: 'console',
  readOnly: true,
  description:
    'Prepares a trustless, zero-fee Radix P2P Atomic Swap manifest (single or multi-resource and single or multi-account on each side): either a Subintent V2 pre-authorization manifest for the Maker to sign and share, or a Direct V1 single-transaction atomic swap manifest between accounts.',
  inputSchema: z.object({
    mode: z.enum(['subintent', 'direct']).optional().default('subintent'),
    makerAccount: accountInputSchema.describe(
      'Maker account address or array of Maker account addresses (primary first; received assets deposit to the first account).',
    ),
    takerAccount: accountInputSchema
      .optional()
      .describe('Taker account address or array of Taker account addresses (required when mode is "direct").'),
    offer: assetInputSchema,
    want: assetInputSchema,
    byAccount: byAccountSchema
      .optional()
      .describe(
        'Optional per-account holdings map for splitting withdrawals across multiple accounts (auto-queried from Gateway on mainnet/stokenet when omitted).',
      ),
  }),
  async handler({ mode, makerAccount, takerAccount, offer, want, byAccount }, ctx) {
    const makerAccounts = Array.isArray(makerAccount) ? makerAccount : [makerAccount];
    const takerAccounts = takerAccount
      ? Array.isArray(takerAccount)
        ? takerAccount
        : [takerAccount]
      : [];

    const allAccounts = [...new Set([...makerAccounts, ...takerAccounts])];
    const needsLookup = !byAccount && (makerAccounts.length > 1 || takerAccounts.length > 1);
    const resolvedByAccount: PerAccountHoldingsMap | undefined =
      byAccount ?? (needsLookup ? await fetchPerAccountHoldings(allAccounts) : undefined);

    const manifest =
      mode === 'direct'
        ? buildDirectAtomicSwapManifest(
            makerAccounts,
            takerAccounts,
            offer as SwapAssetInput,
            want as SwapAssetInput,
            resolvedByAccount,
          )
        : buildMakerSubintentManifest(
            makerAccounts,
            offer as SwapAssetInput,
            want as SwapAssetInput,
            resolvedByAccount,
          );

    if (!manifest) {
      throw new Error(
        'Invalid atomic swap parameters (check account addresses, resource addresses, amounts/IDs, and takerAccount for direct mode).',
      );
    }

    const consoleUrl = `${ctx.origin}/console/atomic-swap`;
    return {
      text: cliRender(
        cliBanner(mode === 'direct' ? 'Direct Atomic Swap (V1)' : 'OTC Subintent Offer (V2)'),
        cliSection('Details'),
        cliKeyValues([
          ['Mode', mode],
          ['Maker', makerAccounts.join(', ')],
          ...(takerAccounts.length > 0 ? [['Taker', takerAccounts.join(', ')] as [string, string]] : []),
          ['Console URL', consoleUrl],
        ]),
        cliSection('Manifest'),
        cliCode(manifest, 'rtm'),
      ),
      structured: {
        mode,
        makerAccount: makerAccounts[0],
        makerAccounts,
        takerAccount: takerAccounts[0] ?? null,
        takerAccounts,
        offer,
        want,
        manifest,
        consoleUrl,
      },
    };
  },
});

export const atomicSwapTools = [prepareAtomicSwapTool];
