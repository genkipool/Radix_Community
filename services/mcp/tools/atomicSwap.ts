/**
 * services/mcp/tools/atomicSwap.ts
 *
 * MCP manifest-preparation tool for trustless P2P Atomic OTC Swaps
 * (both Subintent V2 pre-authorization and Direct V1 atomic swap).
 */

import { z } from 'zod';
import {
  buildDirectAtomicSwapManifest,
  buildMakerSubintentManifest,
  type SwapAssetInput,
} from '@/features/console/lib/atomic-swap';
import { defineMcpTool } from '../registry';
import { cliBanner, cliCode, cliKeyValues, cliRender, cliSection } from '../cli';

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

export const prepareAtomicSwapTool = defineMcpTool({
  name: 'prepare_atomic_swap',
  title: 'Prepare P2P Atomic OTC Swap',
  category: 'console',
  readOnly: true,
  description:
    'Prepares a trustless, zero-fee Radix P2P Atomic Swap manifest (single or multi-resource on each side): either a Subintent V2 pre-authorization manifest for the Maker to sign and share, or a Direct V1 single-transaction atomic swap manifest between two accounts.',
  inputSchema: z.object({
    mode: z.enum(['subintent', 'direct']).optional().default('subintent'),
    makerAccount: z.string().startsWith('account_'),
    takerAccount: z.string().startsWith('account_').optional().describe('Required when mode is "direct"'),
    offer: assetInputSchema,
    want: assetInputSchema,
  }),
  handler({ mode, makerAccount, takerAccount, offer, want }, ctx) {
    const manifest =
      mode === 'direct'
        ? buildDirectAtomicSwapManifest(makerAccount, takerAccount ?? '', offer as SwapAssetInput, want as SwapAssetInput)
        : buildMakerSubintentManifest(makerAccount, offer as SwapAssetInput, want as SwapAssetInput);

    if (!manifest) {
      throw new Error('Invalid atomic swap parameters (check account addresses, resource addresses, amounts/IDs, and takerAccount for direct mode).');
    }

    const consoleUrl = `${ctx.origin}/console/atomic-swap`;
    return {
      text: cliRender(
        cliBanner(mode === 'direct' ? 'Direct Atomic Swap (V1)' : 'OTC Subintent Offer (V2)'),
        cliSection('Details'),
        cliKeyValues([
          ['Mode', mode],
          ['Maker', makerAccount],
          ...(takerAccount ? [['Taker', takerAccount] as [string, string]] : []),
          ['Console URL', consoleUrl],
        ]),
        cliSection('Manifest'),
        cliCode(manifest, 'rtm'),
      ),
      structured: {
        mode,
        makerAccount,
        takerAccount: takerAccount ?? null,
        offer,
        want,
        manifest,
        consoleUrl,
      },
    };
  },
});

export const atomicSwapTools = [prepareAtomicSwapTool];
