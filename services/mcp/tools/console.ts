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
  createNonFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
} from '@/features/console/lib/create-token-manifests';
import { initialMetadataEntry, MetadataType } from '@/features/console/lib/metadata-manifests';
import { accessRuleToManifestSyntax } from '@/features/console/lib/access-rules';
import { inspectAddress } from '@/features/console/lib/address-inspect';
import { buildManifestFlowSteps, type FlowLabels } from '@/features/console/lib/manifest-flow';
import { previewTransaction } from '@/features/console/services/transactionPreview';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { fetchKnownAddresses } from '@/services/gateway/knownAddresses';
import {
  convertOlympiaAddressDetailed,
  decodeSborHex,
  networkIdFromName,
  staticallyValidateManifest,
} from '@/services/ret';
import {
  buildOlympiaExportPayloads,
  type MnemonicWordCount,
} from '@/features/console/lib/olympia-export';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import type { Network } from '@/services/gateway/client';
import { defineMcpTool } from '../registry';
import { RADIX_COMMUNITY_ORIGIN, dappDefinitionFor, signingSteps } from '../dapp';
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

/**
 * Fails early if an address the manifest will embed is malformed or belongs to
 * a different network, so the user gets a clear message instead of a cryptic
 * static-validation error (or a manifest that previews against the wrong net).
 */
function assertAddressOnNetwork(label: string, address: string, network: Network): void {
  const inspection = inspectAddress(address);
  if (!inspection) {
    throw new Error(`${label} "${address}" is not a valid Radix bech32m address.`);
  }
  if (!inspection.checksumValid) {
    throw new Error(`${label} "${address}" has an invalid checksum.`);
  }
  if (inspection.network !== 'other' && inspection.network !== network) {
    throw new Error(
      `${label} "${address}" is a ${inspection.network} address but the network is ${network}.`,
    );
  }
}

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
    locale: localeSchema,
  }),
  handler: async ({ templateId, values, network, locale }, ctx) => {
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

    // Fail early on malformed / wrong-network addresses before building.
    for (const field of template.fields) {
      const value = (values[field.key] ?? '').trim();
      if (!value) continue;
      if (field.kind === 'account' || field.kind === 'address' || field.kind === 'resource') {
        assertAddressOnNetwork(field.key, value, network);
      }
    }

    const manifest = template.build(values, await templateContext(network)).trim();
    const validation = await staticallyValidateManifest(manifest, network);

    return {
      text: cliRender(
        cliBanner(`Manifest · ${templateId}`),
        cliKeyValues([
          ['Network', network],
          ['Static validation', validation.valid ? 'VALID' : `INVALID — ${validation.error}`],
        ]),
        cliCode(manifest),
        cliNext(signingSteps(ctx.origin, network, locale, validation)),
      ),
      structured: { manifest, network, valid: validation.valid, templateId },
    };
  },
});

export const buildFungibleTokenManifestTool = defineMcpTool({
  name: 'build_fungible_token_manifest',
  title: 'Build fungible token manifest',
  description:
    'Builds the transaction manifest that creates a new fungible token on Radix with sensible defaults (owner: none, transfers open). The initial supply is deposited into the given account. For NFTs use build_nft_collection_manifest; for advanced role setups send the user to the console create-token tool.',
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
    locale: localeSchema,
  }),
  handler: async (input, ctx) => {
    assertAddressOnNetwork('accountAddress', input.accountAddress, input.network);

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

    const text = cliRender(
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
        ...signingSteps(ctx.origin, input.network, input.locale, validation),
        `Advanced options (NFTs, roles, badges): ${ctx.origin}/${input.locale}/console/create-token`,
      ]),
    );
    return {
      text,
      structured: { manifest, network: input.network, symbol: input.symbol, valid: validation.valid },
    };
  },
});

export const buildNftCollectionManifestTool = defineMcpTool({
  name: 'build_nft_collection_manifest',
  title: 'Build NFT collection manifest',
  description:
    'Builds the transaction manifest that creates a new non-fungible resource (NFT collection) on Radix with a set of initial NFTs (name, description, image), sensible defaults (owner: none, transfers open). The NFTs are deposited into the given account. For custom data fields or advanced role setups, send the user to the console create-token tool.',
  category: 'console',
  inputSchema: z.object({
    accountAddress: z
      .string()
      .min(10)
      .max(120)
      .describe('Account that receives the minted NFTs'),
    name: z.string().min(1).max(64).describe('Collection name, e.g. "My Collection"'),
    description: z.string().max(300).optional().describe('Collection description'),
    iconUrl: z.string().max(300).optional().describe('HTTPS URL of the collection icon'),
    nfts: z
      .array(
        z.object({
          name: z.string().min(1).max(64).describe('NFT name'),
          description: z.string().max(300).optional().describe('NFT description'),
          imageUrl: z.string().max(300).optional().describe('HTTPS URL of the NFT image'),
        }),
      )
      .min(1)
      .max(50)
      .describe('Initial NFTs to mint into the collection'),
    mintable: z.boolean().default(false).describe('Allow minting more NFTs later'),
    burnable: z.boolean().default(false).describe('Allow burning NFTs'),
    network: networkSchema,
    locale: localeSchema,
  }),
  handler: async (input, ctx) => {
    assertAddressOnNetwork('accountAddress', input.accountAddress, input.network);

    const metadata = [
      initialMetadataEntry('name', input.name, false),
      ...(input.description ? [initialMetadataEntry('description', input.description, false)] : []),
      ...(input.iconUrl ? [initialMetadataEntry('icon_url', input.iconUrl, false, MetadataType.Url)] : []),
    ].join(`,
          `);

    const manifest = createNonFungibleTokenManifest({
      ownerAccessRule: { type: 'none' },
      ownerRoleUpdatable: 'None',
      accountAddress: input.accountAddress,
      trackSupply: true,
      metadata,
      authRoles: {
        ...DEFAULT_AUTH_ROLES,
        minter: input.mintable ? 'allowAll' : 'denyAll',
        burner: input.burnable ? 'allowAll' : 'denyAll',
      },
      nfts: input.nfts.map((nft) => ({
        name: nft.name,
        description: nft.description ?? '',
        key_image_url: nft.imageUrl ?? '',
        customData: {},
      })),
      nftBaseFieldsLocked: { name: false, description: false, key_image_url: false },
      nftCustomFields: [],
    }).trim();

    const validation = await staticallyValidateManifest(manifest, input.network);

    const text = cliRender(
      cliBanner(`NFT collection · ${input.name}`),
      cliKeyValues([
        ['Collection', input.name],
        ['Initial NFTs', String(input.nfts.length)],
        ['Mintable / burnable', `${input.mintable} / ${input.burnable}`],
        ['Network', input.network],
        ['Static validation', validation.valid ? 'VALID' : `INVALID — ${validation.error}`],
      ]),
      cliCode(manifest),
      cliNext([
        ...signingSteps(ctx.origin, input.network, input.locale, validation),
        `Advanced options (custom data fields, roles, badges): ${ctx.origin}/${input.locale}/console/create-token`,
      ]),
    );
    return {
      text,
      structured: { manifest, network: input.network, nftCount: input.nfts.length, valid: validation.valid },
    };
  },
});

export const buildFaucetManifestTool = defineMcpTool({
  name: 'build_faucet_manifest',
  title: 'Build a Stokenet faucet manifest',
  description:
    'Builds the manifest that requests free test XRD from the Stokenet faucet and deposits it into an account. Stokenet only — mainnet has no faucet. Use it to fund a test account before other transactions.',
  category: 'console',
  inputSchema: z.object({
    accountAddress: z
      .string()
      .min(10)
      .max(120)
      .describe('Stokenet account to fund (account_tdx_2_…)'),
    locale: localeSchema,
  }),
  handler: async ({ accountAddress, locale }, ctx) => {
    const network: Network = 'stokenet';
    assertAddressOnNetwork('accountAddress', accountAddress, network);

    const known = await fetchKnownAddresses(network);
    const faucet = known.faucet;
    if (!faucet) throw new Error('Faucet address not found for Stokenet.');

    const manifest = `CALL_METHOD
    Address("${faucet}")
    "free"
;
CALL_METHOD
    Address("${accountAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;`;

    const validation = await staticallyValidateManifest(manifest, network);

    const text = cliRender(
      cliBanner('Stokenet faucet · free XRD'),
      cliKeyValues([
        ['Account', accountAddress],
        ['Faucet', faucet],
        ['Network', network],
        ['Static validation', validation.valid ? 'VALID' : `INVALID — ${validation.error}`],
      ]),
      cliCode(manifest),
      cliNext(signingSteps(ctx.origin, network, locale, validation)),
    );
    return { text, structured: { manifest, network, faucet, account: accountAddress, valid: validation.valid } };
  },
});

export const buildDeployPackageManifestTool = defineMcpTool({
  name: 'build_deploy_package_manifest',
  title: 'Prepare a Scrypto package deployment',
  description:
    'Decodes a compiled .rpd package definition (Manifest SBOR) into the value needed to publish a Scrypto package, and returns the exact deploy_package call to run on the local radix-connector. The WASM is NOT handled here (too large for the agent) — the connector reads it from disk. Use this before deploy_package.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    rpdHex: z
      .string()
      .regex(/^[0-9a-fA-F]+$/, 'Must be a hex string')
      .max(4_000_000)
      .describe('Hex-encoded contents of the compiled .rpd package-definition file'),
    owner: z
      .enum(['none', 'allowAll'])
      .default('none')
      .describe('Package owner: "none" (no owner) or "allowAll" (anyone can update it)'),
    network: networkSchema,
  }),
  handler: async ({ rpdHex, owner, network }) => {
    const decoded = await decodeSborHex(rpdHex, network).catch((err: unknown) => {
      throw new Error(err instanceof Error ? err.message : 'Failed to decode the .rpd');
    });
    if (decoded.kind !== 'manifest') {
      throw new Error('The .rpd must be a Manifest-SBOR package definition (prefix 0x4d).');
    }
    const packageDefinition = decoded.decoded;
    const ownerRole = accessRuleToManifestSyntax(
      owner === 'none' ? { type: 'none' } : { type: 'allowAll' },
      'None',
    );

    const text = cliRender(
      cliBanner('Deploy package · definition ready'),
      cliKeyValues([
        ['Network', network],
        ['Owner', owner],
      ]),
      'Package definition (Manifest SBOR) — pass it as `package_definition`:',
      cliCode(packageDefinition),
      owner !== 'none'
        ? `OwnerRole — pass it as \`owner_role\`:\n${cliCode(ownerRole)}`
        : undefined,
      cliNext([
        'This HTTP server cannot attach the WASM blob. Sign on the local radix-connector, which reads the .wasm from disk (it never travels through the agent):',
        `  deploy_package { "wasm_path": "<path to your .wasm>", "package_definition": <the value above>, "network": "${network}"${owner !== 'none' ? ', "owner_role": <the value above>' : ''} }`,
        'If the connector is not installed, call setup_wallet_connector first.',
        'deploy_package dry-runs the deploy on the Gateway (with the WASM blob) before asking you to approve, and aborts if it would fail — so you never pay for a failing deploy.',
      ]),
    );
    return { text, structured: { packageDefinition, ownerRole, network, owner } };
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
    'Converts a legacy Olympia address (rdx1… account or _rr1… resource) into its Babylon equivalent. For accounts it also returns the compressed secp256k1 public key embedded in the address, and the wallet-import QR payload string the Radix Wallet scans to import the legacy account (Settings → "Import from a Legacy Wallet"). Render that string as a QR (or save it) to complete the import. The payload holds only public data, never a seed phrase or private key.',
  category: 'console',
  readOnly: true,
  inputSchema: z.object({
    olympiaAddress: z.string().min(10).max(120).describe('Olympia address (rdx1… or …_rr1…)'),
    network: networkSchema,
    // Wallet-import QR options — must mirror the original Olympia wallet setup.
    accountType: z
      .enum(['S', 'H'])
      .default('S')
      .describe('Original Olympia account type: "S" software (seed phrase) or "H" hardware (Ledger).'),
    addressIndex: z
      .number()
      .int()
      .min(0)
      .max(999_999_999)
      .default(0)
      .describe('BIP44 address index the account was derived with (0 for the first account).'),
    accountName: z
      .string()
      .max(30)
      .default('')
      .describe('Display name shown in the mobile wallet during import (max 30 chars).'),
    wordCount: z
      .union([z.literal(12), z.literal(15), z.literal(18), z.literal(21), z.literal(24)])
      .default(12)
      .describe('Seed-phrase word count of the original Olympia wallet (12, 15, 18, 21 or 24).'),
  }),
  handler: async ({ olympiaAddress, network, accountType, addressIndex, accountName, wordCount }) => {
    const conversion = await convertOlympiaAddressDetailed(olympiaAddress, network).catch(() => {
      throw new Error('Invalid Olympia address');
    });

    // For accounts, also build the legacy-wallet import QR payload so an agent
    // can render/save it. Resources have no public key and no import payload.
    let importPayload: string | null = null;
    if (conversion.publicKeyHex) {
      importPayload =
        buildOlympiaExportPayloads(
          [
            {
              accountType,
              publicKeyHex: conversion.publicKeyHex,
              addressIndex,
              name: accountName,
            },
          ],
          wordCount as MnemonicWordCount,
        )[0] ?? null;
    }

    const blocks: Array<string | false | undefined> = [
      cliBanner('Olympia → Babylon'),
      cliKeyValues([
        ['Olympia address', olympiaAddress],
        ['Kind', conversion.kind],
        ['Babylon address', conversion.babylonAddress],
        ...(conversion.publicKeyHex
          ? ([['Public key (secp256k1)', conversion.publicKeyHex]] as [string, string][])
          : []),
        ['Network', network],
      ]),
    ];
    if (importPayload) {
      blocks.push(
        cliSection('Wallet import QR payload'),
        cliKeyValues([
          ['Account type', accountType === 'S' ? 'software (seed phrase)' : 'hardware (Ledger)'],
          ['Address index', addressIndex],
          ['Word count', `${wordCount} (must match the original wallet)`],
        ]),
        cliCode(importPayload),
        cliNext([
          'Render this payload string as a QR code (or save it as a PNG).',
          'In the Radix Wallet: Settings → "Import from a Legacy Wallet" and scan it.',
        ]),
      );
    }
    const text = cliRender(...blocks);

    return {
      text,
      structured: {
        kind: conversion.kind,
        babylonAddress: conversion.babylonAddress,
        publicKeyHex: conversion.publicKeyHex ?? null,
        importPayload,
      },
    };
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
    locale: localeSchema,
    blobs: z
      .array(z.string().regex(/^[0-9a-fA-F]+$/, 'Must be hex'))
      .max(10)
      .optional()
      .describe('Hex-encoded blobs referenced by the manifest via Blob("<hash>"), e.g. package WASM. Required to dry-run a package deploy.'),
  }),
  handler: async ({ manifest, network, locale, blobs }, ctx) => {
    const preview = await previewTransaction(manifest, network, blobs);

    const text = cliRender(
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
          ? `The simulation succeeded. Sign it with the radix-connector send_transaction (pass dapp_definition + origin — see build_manifest_from_template) or manually at ${ctx.origin}/${locale}/console/transaction-manifest.`
          : 'The simulation did not succeed — fix the manifest before asking the user to sign.',
      ]),
    );
    return {
      text,
      structured: {
        status: preview.status,
        succeeded: preview.status === 'Succeeded',
        feeXrd: preview.feeXrd,
        errorMessage: preview.errorMessage,
      },
    };
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
    'Canonical well-known addresses of a network: XRD resource, faucet, native packages (account, pool, validator, …), system badges, plus this site\'s dApp definition + origin to pass to the wallet when signing. Use it to fill manifest addresses without guessing.',
  category: 'console',
  inputSchema: z.object({ network: networkSchema }),
  handler: async ({ network }) => {
    const known = await fetchKnownAddresses(network);
    const dappDefinition = dappDefinitionFor(network);
    return cliRender(
      cliBanner('Well-known addresses'),
      cliKeyValues([['Network', network]]),
      cliKeyValues([
        ['dapp_definition', dappDefinition || '(not configured for this network)'],
        ['dapp origin', RADIX_COMMUNITY_ORIGIN],
      ]),
      'Pass dapp_definition + origin to radix-connector send_transaction / request_account_proof so the wallet treats the request as a verified dApp.',
      cliKeyValues(Object.entries(known).sort(([a], [b]) => a.localeCompare(b))),
    );
  },
});

export const consoleTools = [
  listConsoleToolsTool,
  listManifestTemplatesTool,
  buildManifestFromTemplateTool,
  buildFungibleTokenManifestTool,
  buildNftCollectionManifestTool,
  buildFaucetManifestTool,
  buildDeployPackageManifestTool,
  validateManifestTool,
  previewTransactionTool,
  explainManifestTool,
  decodeSborTool,
  convertOlympiaAddressTool,
  inspectAddressTool,
  getKnownAddressesTool,
];
