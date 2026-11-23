/**
 * services/mcp/tools/accountOps.ts
 *
 * MCP manifest-preparation tools for Account Migration and Account Cleanup.
 * Shares pure manifest builders with the Console UI (zero Redis commands).
 */

import { z } from 'zod';
import { mapHoldings } from '@/features/console/lib/account-holdings';
import { buildCleanupBatches, inspectCleanupItems } from '@/features/console/lib/account-cleanup';
import { buildMigrateBatches, buildMigrateItems, inspectNonWithdrawableResources } from '@/features/console/lib/account-migrate';
import { gatewayPost } from '@/services/gateway/bases';
import { fetchEntityDetailsLive } from '@/services/gateway/entities';
import { defineMcpTool } from '../registry';
import { cliBanner, cliCode, cliKeyValues, cliRender, cliSection } from '../cli';
import { networkSchema } from './schemas';

export const prepareAccountMigrateTool = defineMcpTool({
  name: 'prepare_account_migrate',
  title: 'Prepare Account Migration / Sweep',
  category: 'console',
  readOnly: true,
  description:
    'Prepares batched Radix transaction manifests to migrate/sweep fungible tokens, LSUs, NFTs, and XRD (leaving a fee reserve) from one account to another. Excludes critical system owner badges by default unless includeCriticalBadges is true.',
  inputSchema: z.object({
    fromAccount: z.string().startsWith('account_'),
    toAccount: z.string().startsWith('account_'),
    network: networkSchema.optional().default('mainnet'),
    xrdReserve: z.string().optional().default('2'),
    includeNfts: z.boolean().optional().default(true),
    includeCriticalBadges: z.boolean().optional().default(false),
  }),
  async handler({ fromAccount, toAccount, network, xrdReserve, includeNfts, includeCriticalBadges }, ctx) {
    if (fromAccount === toAccount) throw new Error('Source and destination accounts must differ.');
    const details = await fetchEntityDetailsLive(fromAccount, network);
    const holdings = mapHoldings(details as Record<string, unknown>);
    const rawItems = buildMigrateItems(holdings);
    const nonWithdrawable = await inspectNonWithdrawableResources(
      (ep, body) => gatewayPost(network, ep, body),
      rawItems.map((it) => it.resourceAddress),
    );
    const items = rawItems.filter((it) => {
      if (nonWithdrawable.has(it.resourceAddress)) return false;
      if (it.kind === 'criticalBadge') return includeCriticalBadges;
      if (it.kind === 'nft') return includeNfts;
      return true;
    });
    const batches = buildMigrateBatches(fromAccount, toAccount, items, xrdReserve);
    if (batches.length === 0) {
      throw new Error('No transferable assets found in the source account.');
    }

    const consoleUrl = `${ctx.origin}/console/account-migrate`;
    return {
      text: cliRender(
        cliBanner('Account Migration / Sweep'),
        cliSection('Summary'),
        cliKeyValues([
          ['From', fromAccount],
          ['To', toAccount],
          ['Selected assets', items.length],
          ['XRD fee reserve', `${xrdReserve} XRD`],
          ['Batches', batches.length],
          ['Console URL', consoleUrl],
        ]),
        cliSection('Batch 1 Manifest'),
        cliCode(batches[0].manifest, 'rtm'),
      ),
      structured: {
        fromAccount,
        toAccount,
        network,
        selectedCount: items.length,
        batches,
        consoleUrl,
      },
    };
  },
});

export const prepareAccountCleanupTool = defineMcpTool({
  name: 'prepare_account_cleanup',
  title: 'Prepare Account Spam Cleanup & Auto-Deny',
  category: 'console',
  readOnly: true,
  description:
    'Prepares batched Radix transaction manifests to burn freely-burnable spam tokens/NFTs (or sweep non-burnable ones to an optional sinkAccount) and block future deposits via set_resource_preference(Disallowed). Protects XRD, validator LSUs, and system owner badges.',
  inputSchema: z.object({
    account: z.string().startsWith('account_'),
    resources: z.array(z.string().startsWith('resource_')).min(1),
    network: networkSchema.optional().default('mainnet'),
    denyDeposits: z.boolean().optional().default(true),
    sinkAccount: z.string().startsWith('account_').optional(),
  }),
  async handler({ account, resources, network, denyDeposits, sinkAccount }, ctx) {
    const details = await fetchEntityDetailsLive(account, network);
    const holdings = mapHoldings(details as Record<string, unknown>);
    const inspected = await inspectCleanupItems((ep, body) => gatewayPost(network, ep, body), holdings);
    const requestedSet = new Set(resources);
    const selected = inspected.filter((it) => !it.protected && requestedSet.has(it.resourceAddress));

    const batches = buildCleanupBatches({ account, items: selected, denyDeposits, sinkAccount });
    if (batches.length === 0) {
      throw new Error('None of the requested resources could be cleaned (protected, not held, or non-burnable without sinkAccount/denyDeposits).');
    }

    const consoleUrl = `${ctx.origin}/console/account-cleanup`;
    return {
      text: cliRender(
        cliBanner('Account Cleanup & Auto-Deny'),
        cliSection('Summary'),
        cliKeyValues([
          ['Account', account],
          ['Resources cleaned', selected.length],
          ['Auto-deny deposits', denyDeposits ? 'Yes' : 'No'],
          ['Sink account', sinkAccount ?? '(burn only)'],
          ['Batches', batches.length],
          ['Console URL', consoleUrl],
        ]),
        cliSection('Batch 1 Manifest'),
        cliCode(batches[0].manifest, 'rtm'),
      ),
      structured: {
        account,
        network,
        cleanedResources: selected.map((s) => s.resourceAddress),
        batches,
        consoleUrl,
      },
    };
  },
});

export const accountOpsTools = [prepareAccountMigrateTool, prepareAccountCleanupTool];
