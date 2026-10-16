/**
 * MCP tools for an account's deposit rules: who may deposit into it. The
 * reader and the manifest builder are the console's own
 * (`features/console/lib/account-deposits`), so the "Account deposits" tool
 * and these tools cannot drift apart.
 */

import { z } from 'zod';

import {
  DEFAULT_DEPOSIT_RULES,
  depositSettingsManifest,
  fetchDepositSettings,
  type DepositorBadge,
  type DepositSettings,
} from '@/features/console/lib/account-deposits';
import type { GatewayPost } from '@/features/console/lib/resource-holders';
import type { Network } from '@/services/gateway/client';
import { gatewayPost } from '@/services/gateway/bases';
import { staticallyValidateManifest } from '@/services/ret';
import { cliBanner, cliCode, cliKeyValues, cliNext, cliRender, cliSection } from '../cli';
import { signingSteps } from '../dapp';
import { defineMcpTool } from '../registry';
import { assertAddressOnNetwork } from './console';
import { localeSchema, networkSchema } from './schemas';

const postFor = (network: Network): GatewayPost => (path, body) => gatewayPost(network, path, body);

const RULE_TEXT: Record<DepositSettings['defaultRule'], string> = {
  Accept: 'accept anything',
  AllowExisting: 'accept only resources it already holds (and XRD)',
  Reject: 'refuse everything',
};

const badgeText = (badge: DepositorBadge) => (badge.nftId ? `${badge.resource}:${badge.nftId}` : badge.resource);

/** "resource" or "resource:#id#" → a depositor badge. */
const parseBadge = (value: string): DepositorBadge => {
  const [resource, nftId] = value.trim().split(':');
  return nftId ? { resource, nftId } : { resource };
};

/** The settings as key/value rows for the CLI view. */
const settingsRows = (settings: DepositSettings): Array<[string, string]> => [
  ['Default rule', `${settings.defaultRule} (${RULE_TEXT[settings.defaultRule]})`],
  ...Object.entries(settings.preferences).map(([resource, preference]): [string, string] => [
    `Exception ${resource}`,
    preference === 'Allowed' ? 'always allowed' : 'always refused',
  ]),
  ...settings.depositors.map((badge): [string, string] => ['Authorised depositor', badgeText(badge)]),
];

export const getDepositRulesTool = defineMcpTool({
  name: 'get_deposit_rules',
  title: 'Read account deposit rules',
  description:
    'Reads who may deposit into one or several accounts, the same view the console\'s "Account deposits" section shows: the default rule (Accept, AllowExisting or Reject), the per-resource exceptions (always allowed / always refused) and the authorised depositor badges. These rules only decide third-party deposits (try_deposit_*); the owner\'s own deposits always land. Use it to explain why an airdrop or a payment did not arrive, or before build_deposit_rules_manifest.',
  category: 'console',
  inputSchema: z.object({
    account: z.union([z.string(), z.array(z.string()).min(1).max(10)]).describe('Account address, or a list of up to 10'),
    network: networkSchema,
  }),
  handler: async ({ account, network }, ctx) => {
    const accounts = [account].flat();
    const results = await Promise.all(
      accounts.map(async (address) => {
        try {
          assertAddressOnNetwork('account', address, network);
          return { address, settings: await fetchDepositSettings(postFor(network), address) };
        } catch (error) {
          return { address, error: error instanceof Error ? error.message : String(error) };
        }
      }),
    );
    return {
      text: cliRender(
        cliBanner(accounts.length > 1 ? `Account deposit rules · ${accounts.length}` : 'Account deposit rules'),
        ...results.map((r) => cliRender(cliSection(r.address), 'error' in r ? r.error : cliKeyValues(settingsRows(r.settings!)))),
        cliNext([`Change them in the console (wallet required): ${ctx.origin}/en/console/account-deposits?account=${accounts[0]}`]),
      ),
      structured: typeof account === 'string' ? results[0] : { accounts: results },
    };
  },
});

export const buildDepositRulesManifestTool = defineMcpTool({
  name: 'build_deposit_rules_manifest',
  title: 'Build account deposit rules manifest',
  description:
    'Builds one transaction that changes who may deposit into an account, starting from what the ledger has now and writing only what changes: the default rule, resources always allowed or always refused, exceptions removed, and authorised depositor badges added or removed. The account itself signs. Refusing deposits does not lose airdrops: a locker keeps what an account refuses until it is claimed.',
  category: 'console',
  inputSchema: z.object({
    account: z.string().describe('Account whose rules change; it signs the transaction'),
    defaultRule: z.enum(DEFAULT_DEPOSIT_RULES).optional().describe('New default rule: "Accept", "AllowExisting" or "Reject"'),
    allow: z.array(z.string()).optional().describe('Resources always allowed, whatever the default rule'),
    refuse: z.array(z.string()).optional().describe('Resources always refused, whatever the default rule'),
    removeExceptions: z.array(z.string()).optional().describe('Resources whose exception is removed (they follow the default rule again)'),
    addDepositors: z.array(z.string()).optional().describe('Badges to authorise: "resource_…", or "resource_…:#id#" for one NFT'),
    removeDepositors: z.array(z.string()).optional().describe('Authorised badges to remove, written the same way'),
    network: networkSchema,
    locale: localeSchema,
  }),
  handler: async (input, ctx) => {
    const { account, network, locale } = input;
    assertAddressOnNetwork('account', account, network);
    const resources = [...(input.allow ?? []), ...(input.refuse ?? []), ...(input.removeExceptions ?? [])];
    resources.forEach((r) => assertAddressOnNetwork('resource', r, network));

    const current = await fetchDepositSettings(postFor(network), account);
    const preferences = { ...current.preferences };
    for (const r of input.removeExceptions ?? []) delete preferences[r];
    for (const r of input.allow ?? []) preferences[r] = 'Allowed';
    for (const r of input.refuse ?? []) preferences[r] = 'Disallowed';
    const removed = (input.removeDepositors ?? []).map(parseBadge);
    const same = (a: DepositorBadge, b: DepositorBadge) => a.resource === b.resource && (a.nftId ?? '') === (b.nftId ?? '');
    const depositors = [
      ...current.depositors.filter((d) => !removed.some((r) => same(r, d))),
      ...(input.addDepositors ?? []).map(parseBadge).filter((a) => !current.depositors.some((d) => same(a, d))),
    ];
    const next: DepositSettings = { defaultRule: input.defaultRule ?? current.defaultRule, preferences, depositors };

    const manifest = depositSettingsManifest(account, current, next).trim();
    if (!manifest) return `Nothing changes: ${account} already has those deposit rules.`;
    const validation = await staticallyValidateManifest(manifest, network);
    return {
      text: cliRender(
        cliBanner('Account deposit rules · change'),
        cliCode(manifest),
        cliSection('Now'),
        cliKeyValues(settingsRows(current)),
        cliSection('After signing'),
        cliKeyValues(settingsRows(next)),
        cliKeyValues([
          ['Network', network],
          ['Static validation', validation.valid ? 'VALID' : `INVALID: ${validation.error}`],
        ]),
        cliNext([
          ...signingSteps(ctx.origin, network, locale, validation),
          `Console form: ${ctx.origin}/${locale}/console/account-deposits?account=${account}`,
        ]),
      ),
      structured: { manifest, network, valid: validation.valid, current, next },
    };
  },
});

export const depositTools = [getDepositRulesTool, buildDepositRulesManifestTool];
