/**
 * services/mcp/tools/console.ts
 *
 * Console tools: everything the web console can do, exposed to AI clients.
 * MCP cannot sign transactions — tools that would move funds return a ready
 * transaction manifest plus the console URL where the user signs it with
 * their Radix wallet.
 */

import { z } from 'zod';
import { CONSOLE_TOOL_SLUGS } from '@/features/console/types/console.types';
import { CONSOLE_TOOLS, groupForTool } from '@/features/console/data/consoleTools';
import {
  MANIFEST_TEMPLATES,
  isTemplateComplete,
  type TemplateContext,
} from '@/features/console/lib/manifest-templates';
import {
  createFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
} from '@/features/console/lib/create-token-manifests';
import { initialMetadataEntry, MetadataType } from '@/features/console/lib/metadata-manifests';
import { inspectAddress } from '@/features/console/lib/address-inspect';
import { buildManifestFlowSteps, type FlowLabels } from '@/features/console/lib/manifest-flow';
import { previewTransaction } from '@/features/console/services/transactionPreview';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { fetchKnownAddresses } from '@/services/gateway/knownAddresses';
import {
  convertOlympiaAddress,
  decodeSborHex,
  networkIdFromName,
  staticallyValidateManifest,
} from '@/services/ret';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import type { Network } from '@/services/gateway/client';
import { defineMcpTool } from '../registry';
import { cliBanner, cliCode, cliKeyValues, cliNext, cliRender, cliSection, cliTable } from '../cli';

const networkSchema = z
  .enum(['mainnet', 'stokenet'])
  .default('mainnet')
  .describe('Radix network: "mainnet" (production) or "stokenet" (testnet)');

const localeSchema = z
  .enum(['en', 'es'])
  .default('en')
  .describe('Language of the returned labels/links: "en" or "es"');

interface ToolLabels {
  title?: string;
  description?: string;
}

async function consoleDictionary(locale: Locale) {
  const t = await getFeatureDictionary(locale, ['console']);
  return t.console as unknown as {
    tools: Record<string, ToolLabels>;
    groups: Record<string, string>;
    buildManifest: {
      templates: Record<string, { name: string; description: string; fields: Record<string, string> }>;
    };
    manifest: { flow: FlowLabels };
  };
}

async function templateContext(network: Network): Promise<TemplateContext> {
  const constants = RADIX_TOKEN_ADDRESSES[networkIdFromName(network)];
  const known = await fetchKnownAddresses(network).catch(() => ({} as Record<string, string>));
  return {
    xrdAddress: constants.XRD,
    poolPackage: known.pool_package ?? '',
    validatorOwnerBadge: constants.OWNER_BADGE,
  };
}

/** Standard "how to sign this manifest" footer. */
const signingSteps = (origin: string, validation: { valid: boolean; error?: string }) => [
  validation.valid
    ? 'The manifest was statically validated by the Radix Engine Toolkit — it is syntactically correct.'
    : `Static validation FAILED: ${validation.error}. Fix the inputs before signing.`,
  'Dry-run it with preview_transaction to see the real fee and balance changes before signing.',
  `Ask the user to open ${origin}/en/console/transaction-manifest, paste the manifest, and sign it with their Radix wallet (MCP cannot sign transactions).`,
];

export const listConsoleToolsTool = defineMcpTool({
  name: 'list_console_tools',
  title: 'List console tools',
  description:
    'Lists every tool of the web developer console (send transactions, staking, token creation, package deployment, metadata, SBOR decoding, …) with its URL and whether it needs a connected wallet. Use it to route the user to the right console page.',
  category: 'console',
  inputSchema: z.object({ locale: localeSchema }),
  handler: async ({ locale }, ctx) => {
    const dict = await consoleDictionary(locale);

    return cliRender(
      cliBanner('Radix web console · tools'),
      cliTable(
        ['Tool', 'Group', 'Wallet', 'URL'],
        CONSOLE_TOOL_SLUGS.map((slug) => [
          dict.tools[slug]?.title ?? slug,
          dict.groups[groupForTool(slug).id] ?? groupForTool(slug).id,
          CONSOLE_TOOLS[slug].requiresWallet ? 'required' : 'no',
          `${ctx.origin}/${locale}/console/${slug}`,
        ]),
      ),
      `${cliSection('Descriptions')}\n${CONSOLE_TOOL_SLUGS.map(
        (slug) => `• ${dict.tools[slug]?.title ?? slug}: ${dict.tools[slug]?.description ?? ''}`,
      ).join('\n')}`,
    );
  },
});

export const listManifestTemplatesTool = defineMcpTool({
  name: 'list_manifest_templates',
  title: 'List manifest templates',
  description:
    'Lists the ready-made transaction manifest templates (transfer tokens/NFTs, stake, unstake, claim, mint, burn, create pool, faucet, …) with the fields each one needs. Use build_manifest_from_template to render one.',
  category: 'console',
  inputSchema: z.object({ locale: localeSchema }),
  handler: async ({ locale }) => {
    const dict = await consoleDictionary(locale);
    const labels = dict.buildManifest.templates;

    return cliRender(
      cliBanner('Manifest templates'),
      ...MANIFEST_TEMPLATES.map((template) => {
        const label = labels[template.id];
        return cliKeyValues([
          ['Template id', template.id],
          ['Name', label?.name ?? template.id],
          ['Description', label?.description],
          [
            'Fields',
            template.fields
              .map(
                (field) =>
                  `${field.key} (${field.kind}${field.optional ? ', optional' : ''})`,
              )
              .join(', '),
          ],
        ]);
      }),
      'Render one with build_manifest_from_template { "templateId": "…", "values": { field: value } }.',
    );
  },
});

export const buildManifestFromTemplateTool = defineMcpTool({
  name: 'build_manifest_from_template',
  title: 'Build manifest from template',
  description:
    'Renders a ready-made transaction manifest template (see list_manifest_templates for ids and fields) with the given field values, validates it, and returns the manifest ready to be signed in the web console.',
  category: 'console',
  inputSchema: z.object({
    templateId: z.string().max(60).describe('Template id from list_manifest_templates'),
    values: z
      .record(z.string(), z.string())
      .describe('Field values keyed by field key, e.g. { "from": "account_rdx1…", "amount": "10" }'),
    network: networkSchema,
  }),
  handler: async ({ templateId, values, network }, ctx) => {
    const template = MANIFEST_TEMPLATES.find((candidate) => candidate.id === templateId);
    if (!template) {
      throw new Error(
        `Unknown templateId "${templateId}". Valid ids: ${MANIFEST_TEMPLATES.map((t) => t.id).join(', ')}`,
      );
    }
    if (!isTemplateComplete(template, values)) {
      const missing = template.fields
        .filter((field) => !field.optional && !(values[field.key] ?? '').trim())
        .map((field) => field.key);
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    const manifest = template.build(values, await templateContext(network)).trim();
    const validation = await staticallyValidateManifest(manifest, network);

    return cliRender(
      cliBanner(`Manifest · ${templateId}`),
      cliKeyValues([
        ['Network', network],
        ['Static validation', validation.valid ? 'VALID' : `INVALID — ${validation.error}`],
      ]),
      cliCode(manifest),
      cliNext(signingSteps(ctx.origin, validation)),
    );
  },
});

export const buildFungibleTokenManifestTool = defineMcpTool({
  name: 'build_fungible_token_manifest',
  title: 'Build fungible token manifest',
  description:
    'Builds the transaction manifest that creates a new fungible token on Radix with sensible defaults (owner: none, transfers open). The initial supply is deposited into the given account. For NFTs or advanced role setups, send the user to the console create-token tool.',
  category: 'console',
  inputSchema: z.object({
    accountAddress: z
      .string()
      .min(10)
      .max(120)
      .describe('Account that receives the initial supply'),
    name: z.string().min(1).max(64).describe('Token name, e.g. "My Token"'),
    symbol: z.string().min(1).max(16).describe('Ticker symbol, e.g. "MTK"'),
    description: z.string().max(300).optional().describe('Token description'),
    iconUrl: z.string().max(300).optional().describe('HTTPS URL of the token icon'),
    initialSupply: z.string().min(1).max(30).describe('Initial supply as decimal string, e.g. "1000000"'),
    divisibility: z.number().int().min(0).max(18).default(18).describe('Decimal places (0-18)'),
    mintable: z.boolean().default(false).describe('Allow anyone to mint more supply'),
    burnable: z.boolean().default(false).describe('Allow anyone to burn supply'),
    network: networkSchema,
  }),
  handler: async (input, ctx) => {
    const metadata = [
      initialMetadataEntry('name', input.name, false),
      initialMetadataEntry('symbol', input.symbol, false),
      ...(input.description ? [initialMetadataEntry('description', input.description, false)] : []),
      ...(input.iconUrl ? [initialMetadataEntry('icon_url', input.iconUrl, false, MetadataType.Url)] : []),
    ].join(`,
          `);

    const manifest = createFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'None',
      accountAddress: input.accountAddress,
      trackSupply: true,
      divisibility: String(input.divisibility),
      initialSupply: input.initialSupply,
      metadata,
      authRoles: {
        ...DEFAULT_AUTH_ROLES,
        minter: input.mintable ? 'allowAll' : 'denyAll',
        burner: input.burnable ? 'allowAll' : 'denyAll',
      },
    }).trim();

    const validation = await staticallyValidateManifest(manifest, input.network);

    return cliRender(
      cliBanner(`Token manifest · ${input.symbol}`),
      cliKeyValues([
        ['Token', `${input.name} (${input.symbol})`],
        ['Initial supply', input.initialSupply],
        ['Divisibility', input.divisibility],
        ['Mintable / burnable', `${input.mintable} / ${input.burnable}`],
        ['Network', input.network],
        ['Static validation', validation.valid ? 'VALID' : `INVALID — ${validation.error}`],
      ]),
      cliCode(manifest),
      cliNext([
        ...signingSteps(ctx.origin, validation),
        `Advanced options (NFTs, roles, badges): ${ctx.origin}/en/console/create-token`,
      ]),
    );
  },
});

export const validateManifestTool = defineMcpTool({
  name: 'validate_transaction_manifest',
  title: 'Validate a transaction manifest',
  description:
    'Statically validates Radix transaction manifest syntax with the Radix Engine Toolkit and reports the exact parse error if invalid.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    manifest: z.string().min(1).max(100_000).describe('Transaction manifest source text'),
    network: networkSchema,
  }),
  handler: async ({ manifest, network }) => {
    const validation = await staticallyValidateManifest(manifest, network);
    return cliRender(
      cliBanner('Manifest validation'),
      cliKeyValues([
        ['Network', network],
        ['Result', validation.valid ? 'VALID' : 'INVALID'],
        ['Error', validation.error],
      ]),
    );
  },
});

export const convertOlympiaAddressTool = defineMcpTool({
  name: 'convert_olympia_address',
  title: 'Convert Olympia address',
  description:
    'Converts a legacy Olympia address (rdx1… account or _rr1… resource) into its Babylon equivalent.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    olympiaAddress: z.string().min(10).max(120).describe('Olympia address (rdx1… or …_rr1…)'),
    network: networkSchema,
  }),
  handler: async ({ olympiaAddress, network }) => {
    const babylonAddress = await convertOlympiaAddress(olympiaAddress, network).catch(() => {
      throw new Error('Invalid Olympia address');
    });
    return cliRender(
      cliBanner('Olympia → Babylon'),
      cliKeyValues([
        ['Olympia address', olympiaAddress],
        ['Babylon address', babylonAddress],
        ['Network', network],
      ]),
    );
  },
});

export const inspectAddressTool = defineMcpTool({
  name: 'inspect_address',
  title: 'Inspect a Radix address',
  description:
    'Offline analysis of any Radix bech32m address: entity type (account, resource, component, package, validator, …), network, and checksum validity. No network calls.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    address: z.string().min(4).max(200).describe('Any Radix address or transaction id'),
  }),
  handler: ({ address }) => {
    const inspection = inspectAddress(address);
    if (!inspection) throw new Error('Not a bech32m Radix address.');
    return cliRender(
      cliBanner('Address inspection'),
      cliKeyValues([
        ['Address', address.trim()],
        ['Entity type', inspection.entityType],
        ['Network', inspection.network],
        ['HRP', inspection.hrp],
        ['Checksum', inspection.checksumValid ? 'valid' : 'INVALID'],
      ]),
    );
  },
});

export const previewTransactionTool = defineMcpTool({
  name: 'preview_transaction',
  title: 'Preview (simulate) a transaction',
  description:
    'Dry-runs a transaction manifest on the Gateway without any signature: returns the execution status, total fee in XRD, per-entity balance changes and engine logs. Always preview a manifest before asking the user to sign it.',
  category: 'console',
  inputSchema: z.object({
    manifest: z.string().min(1).max(100_000).describe('Transaction manifest source text'),
    network: networkSchema,
  }),
  handler: async ({ manifest, network }, ctx) => {
    const preview = await previewTransaction(manifest, network);

    return cliRender(
      cliBanner('Transaction preview'),
      cliKeyValues([
        ['Network', network],
        ['Status', preview.status],
        ['Error', preview.errorMessage],
        ['Estimated fee', `${preview.feeXrd.toFixed(4)} XRD`],
      ]),
      preview.balanceChanges.length > 0
        ? `${cliSection('Balance changes')}\n${cliTable(
            ['Entity', 'Resource', 'Change'],
            preview.balanceChanges.map((change) => [
              change.entityAddress,
              change.resourceAddress,
              change.amount,
            ]),
          )}`
        : undefined,
      preview.logs.length > 0
        ? `${cliSection('Engine logs')}\n${preview.logs.slice(0, 10).map((log) => `• ${log}`).join('\n')}`
        : undefined,
      cliNext([
        preview.status === 'Succeeded'
          ? `The simulation succeeded. The user can sign it at ${ctx.origin}/en/console/transaction-manifest.`
          : 'The simulation did not succeed — fix the manifest before asking the user to sign.',
      ]),
    );
  },
});

export const explainManifestTool = defineMcpTool({
  name: 'explain_manifest',
  title: 'Explain a transaction manifest',
  description:
    'Translates a Radix transaction manifest into a plain-language, step-by-step explanation (withdrawals, deposits, proofs, component calls, …) in English or Spanish. Use it to help the user understand what they are about to sign.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    manifest: z.string().min(1).max(100_000).describe('Transaction manifest source text'),
    locale: localeSchema,
  }),
  handler: async ({ manifest, locale }) => {
    const dict = await consoleDictionary(locale);
    const steps = buildManifestFlowSteps(manifest, dict.manifest.flow);
    if (!steps || steps.length === 0) {
      throw new Error('Could not parse any instruction. Check the manifest with validate_transaction_manifest.');
    }

    return cliRender(
      cliBanner('Manifest explained'),
      `${steps.length} step(s):`,
      ...steps.map(
        (step, index) =>
          `${cliSection(`${index + 1}. ${step.title} (${step.instruction})`)}\n${step.description}\n${cliKeyValues(
            step.details.map((detail) => [detail.label, detail.value]),
          )}`,
      ),
    );
  },
});

export const decodeSborTool = defineMcpTool({
  name: 'decode_sbor',
  title: 'Decode an SBOR payload',
  description:
    'Decodes a hex-encoded SBOR payload (component state, events, schemas) into human-readable text. Scrypto vs Manifest SBOR is auto-detected from the prefix byte.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    hex: z
      .string()
      .regex(/^[0-9a-fA-F]+$/, 'Must be a hex string')
      .max(1_000_000)
      .describe('Hex-encoded SBOR payload (starts with 5c for Scrypto, 4d for Manifest)'),
    network: networkSchema,
  }),
  handler: async ({ hex, network }) => {
    const result = await decodeSborHex(hex, network).catch((err: unknown) => {
      throw new Error(err instanceof Error ? err.message : 'Failed to decode payload');
    });
    return cliRender(
      cliBanner('SBOR decoded'),
      cliKeyValues([
        ['Kind', result.kind],
        ['Network', network],
      ]),
      cliCode(result.decoded.slice(0, 6_000), result.kind === 'scrypto' ? 'json' : ''),
    );
  },
});

export const getKnownAddressesTool = defineMcpTool({
  name: 'get_known_addresses',
  title: 'Get well-known network addresses',
  description:
    'Canonical well-known addresses of a network: XRD resource, faucet, native packages (account, pool, validator, …) and system badges. Use it to fill manifest addresses without guessing.',
  category: 'console',
  inputSchema: z.object({ network: networkSchema }),
  handler: async ({ network }) => {
    const known = await fetchKnownAddresses(network);
    return cliRender(
      cliBanner('Well-known addresses'),
      cliKeyValues([['Network', network]]),
      cliKeyValues(Object.entries(known).sort(([a], [b]) => a.localeCompare(b))),
    );
  },
});

export const consoleTools = [
  listConsoleToolsTool,
  listManifestTemplatesTool,
  buildManifestFromTemplateTool,
  buildFungibleTokenManifestTool,
  validateManifestTool,
  previewTransactionTool,
  explainManifestTool,
  decodeSborTool,
  convertOlympiaAddressTool,
  inspectAddressTool,
  getKnownAddressesTool,
];
