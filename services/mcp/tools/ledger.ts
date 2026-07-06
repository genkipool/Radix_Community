/**
 * services/mcp/tools/ledger.ts
 *
 * Ledger tools: inspect any on-chain entity (accounts, components, packages,
 * resources, validators, pools), account balances, transactions and the
 * validator set — on mainnet or stokenet.
 */

import { z } from 'zod';
import { fetchEntityDetails, fetchNonFungibleDataCached } from '@/services/gateway/entities';
import {
  fetchTransactionDetails,
  getRecentTransactionsCached,
  searchTransactionsByAddress,
} from '@/services/gateway/transactions';
import { getValidatorsCached } from '@/services/gateway/validators';
import {
  fetchKeyValueStoreEntries,
  fetchNonFungibleIds,
  fetchResourceHolders,
} from '@/services/gateway/state';
import { fetchBlueprintInterface } from '@/services/gateway/blueprints';
import { getMarketDataCached } from '@/services/marketData';
import { inspectAddress } from '@/features/console/lib/address-inspect';
import { mapHoldings } from '@/features/console/lib/account-holdings';
import {
  typedMetadataToString,
  type GatewayMetadataItem,
} from '@/features/console/lib/metadata-manifests';
import type { NetworkStats, TransactionInfo, Validator } from '@/types/radix';
import { defineMcpTool } from '../registry';
import { cliBanner, cliCode, cliKeyValues, cliList, cliNext, cliRender, cliSection, cliTable } from '../cli';

const networkSchema = z
  .enum(['mainnet', 'stokenet'])
  .default('mainnet')
  .describe('Radix network: "mainnet" (production) or "stokenet" (testnet)');

const addressSchema = z
  .string()
  .min(10)
  .max(120)
  .describe('Bech32m Radix address, e.g. account_rdx1…, component_rdx1…, package_rdx1…, resource_rdx1…, validator_rdx1…');

const MAX_RAW_JSON = 4_000;

/** Compact JSON, truncated so huge entity states don't flood the client. */
function rawJson(value: unknown): string {
  const json = JSON.stringify(value, null, 1) ?? 'null';
  return json.length > MAX_RAW_JSON
    ? `${json.slice(0, MAX_RAW_JSON)}\n… (truncated, ${json.length} chars total)`
    : json;
}

function metadataRows(details: Record<string, unknown>): Array<[string, string]> {
  const items =
    ((details.metadata as { items?: GatewayMetadataItem[] })?.items ?? []).slice(0, 25);
  return items.map((item) => [item.key, typedMetadataToString(item.value?.typed).slice(0, 200)]);
}

const formatXrd = (amount: number) =>
  `${Math.round(amount).toLocaleString('en-US')} XRD`;

/** Compact one-row-per-transaction table shared by the transaction list tools. */
function transactionsTable(transactions: TransactionInfo[]): string {
  return cliTable(
    ['Status', 'Confirmed at', 'Fee (XRD)', 'Epoch', 'Intent hash'],
    transactions.map((tx) => [
      tx.status,
      String(tx.confirmedAt).slice(0, 19),
      tx.feePaid.toFixed(2),
      tx.epoch,
      tx.intentHash,
    ]),
  );
}

export const lookupEntityTool = defineMcpTool({
  name: 'lookup_entity',
  title: 'Look up a ledger entity',
  description:
    'Fetches the on-ledger state of any Radix address: accounts, components, packages, resources (tokens/NFTs), validators, pools, … Returns entity type, metadata and a summary of its details. For account token balances prefer get_account_balances.',
  category: 'ledger',
  inputSchema: z.object({
    address: addressSchema,
    network: networkSchema,
  }),
  handler: async ({ address, network }, ctx) => {
    const inspection = inspectAddress(address);
    if (!inspection || !inspection.checksumValid) {
      throw new Error('Malformed address (bech32m checksum failed). Check for typos.');
    }

    const details = (await fetchEntityDetails(address, network)) as Record<string, unknown>;
    const typed = details.details as Record<string, unknown> | undefined;

    return cliRender(
      cliBanner(`Ledger entity · ${inspection.entityType}`),
      cliKeyValues([
        ['Address', address],
        ['Network', network],
        ['Entity type', inspection.entityType],
        ['Detail type', typed?.type as string | undefined],
      ]),
      `${cliSection('Metadata')}\n${cliKeyValues(metadataRows(details))}`,
      `${cliSection('Raw details')}\n${cliCode(rawJson(typed ?? details), 'json')}`,
      cliNext([
        `Explore it visually: ${ctx.origin}/en/dashboard?search=${address}`,
        inspection.entityType === 'account'
          ? 'Call get_account_balances for its token and NFT holdings.'
          : 'Call search_radix_docs to learn about this entity kind.',
      ]),
    );
  },
});

export const getAccountBalancesTool = defineMcpTool({
  name: 'get_account_balances',
  title: 'Get account balances',
  description:
    'Lists the fungible tokens (with amounts) and non-fungible tokens (with local ids) held by a Radix account.',
  category: 'ledger',
  inputSchema: z.object({
    address: addressSchema.describe('Account address (account_rdx1… / account_tdx_2_1…)'),
    network: networkSchema,
  }),
  handler: async ({ address, network }) => {
    const details = (await fetchEntityDetails(address, network)) as Record<string, unknown>;
    const { fungibles, nonFungibles } = mapHoldings(details);

    return cliRender(
      cliBanner('Account balances'),
      cliKeyValues([
        ['Account', address],
        ['Network', network],
        ['Fungible tokens', fungibles.length],
        ['NFT collections', nonFungibles.length],
      ]),
      `${cliSection('Fungible tokens')}\n${cliTable(
        ['Symbol', 'Name', 'Amount', 'Resource address'],
        fungibles.map((f) => [f.symbol || '—', f.name || '—', f.amount, f.resourceAddress]),
      )}`,
      `${cliSection('Non-fungible tokens')}\n${cliTable(
        ['Name', 'Ids held', 'Resource address'],
        nonFungibles.map((nf) => [
          nf.name || '—',
          `${nf.ids.length}${nf.ids.length > 0 ? ` (${nf.ids.slice(0, 5).join(', ')}${nf.ids.length > 5 ? ', …' : ''})` : ''}`,
          nf.resourceAddress,
        ]),
      )}`,
    );
  },
});

export const getTransactionTool = defineMcpTool({
  name: 'get_transaction',
  title: 'Get transaction details',
  description:
    'Fetches a committed transaction by its intent hash (txid_…): status, fee, timestamp, affected entities, balance changes and the transaction manifest.',
  category: 'ledger',
  inputSchema: z.object({
    intentHash: z.string().min(10).max(120).describe('Transaction intent hash (txid_…)'),
    network: networkSchema,
  }),
  handler: async ({ intentHash, network }, ctx) => {
    const tx = (await fetchTransactionDetails(intentHash, network)) as Record<string, unknown> | null;
    if (!tx) throw new Error(`Transaction not found on ${network}: ${intentHash}`);

    const receipt = tx.receipt as Record<string, unknown> | undefined;
    const feeSummary = receipt?.fee_summary as Record<string, unknown> | undefined;
    const balanceChanges = tx.balance_changes as Record<string, unknown> | undefined;
    const fungibleChanges =
      (balanceChanges?.fungible_balance_changes as Array<Record<string, unknown>> | undefined) ?? [];

    const status = (tx.transaction_status as string) ?? (receipt?.status as string);
    const text = cliRender(
      cliBanner('Transaction'),
      cliKeyValues([
        ['Intent hash', intentHash],
        ['Network', network],
        ['Status', status],
        ['Confirmed at', tx.confirmed_at as string | undefined],
        ['Epoch / round', tx.epoch !== undefined ? `${tx.epoch} / ${tx.round}` : undefined],
        ['Fee paid', tx.fee_paid ? `${tx.fee_paid} XRD` : undefined],
        ['Total cost units', feeSummary?.execution_cost_units_consumed as number | undefined],
        ['Error', receipt?.error_message as string | undefined],
      ]),
      fungibleChanges.length > 0
        ? `${cliSection('Balance changes')}\n${cliTable(
            ['Entity', 'Resource', 'Change'],
            fungibleChanges
              .slice(0, 15)
              .map((change) => [
                String(change.entity_address ?? ''),
                String(change.resource_address ?? ''),
                String(change.balance_change ?? ''),
              ]),
          )}`
        : undefined,
      tx.affected_global_entities
        ? `${cliSection('Affected entities')}\n${(tx.affected_global_entities as string[])
            .slice(0, 20)
            .map((entity) => `• ${entity}`)
            .join('\n')}`
        : undefined,
      tx.manifest_instructions
        ? `${cliSection('Manifest')}\n${cliCode(String(tx.manifest_instructions).slice(0, 3_000))}`
        : undefined,
      cliNext([`Explore it visually: ${ctx.origin}/en/dashboard?search=${intentHash}`]),
    );
    return {
      text,
      structured: {
        intentHash,
        network,
        status,
        committedSuccess: status === 'CommittedSuccess',
        feePaidXrd: tx.fee_paid ?? null,
        affectedEntities: (tx.affected_global_entities as string[] | undefined) ?? [],
      },
    };
  },
});

export const listValidatorsTool = defineMcpTool({
  name: 'list_validators',
  title: 'List network validators',
  description:
    'Lists the validators of the Radix network ordered by stake rank, with stake, fee, uptime and APY. Filter by name or address with "find". Use it to answer questions about staking targets or a specific validator.',
  category: 'ledger',
  inputSchema: z.object({
    network: networkSchema,
    find: z
      .string()
      .max(100)
      .optional()
      .describe('Optional case-insensitive filter on validator name or address'),
    limit: z.number().int().min(1).max(200).default(20).describe('Max validators to return'),
  }),
  handler: async ({ network, find, limit }, ctx) => {
    const { validators } = (await getValidatorsCached(network)) as { validators: Validator[] };

    const needle = find?.toLowerCase();
    const matching = validators
      .filter(
        (validator) =>
          !needle ||
          validator.name.toLowerCase().includes(needle) ||
          validator.address.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);

    if (matching.length === 0) {
      return cliRender(
        cliBanner('Validators'),
        `No validator matched "${find}" on ${network}.`,
      );
    }

    return cliRender(
      cliBanner('Validators'),
      cliKeyValues([
        ['Network', network],
        ['Registered validators', validators.length],
        ['Showing', matching.length],
      ]),
      cliTable(
        ['Rank', 'Name', 'Stake', 'Fee', 'APY', 'Uptime', 'Accepts stake', 'Address'],
        matching.map((validator) => [
          validator.rank,
          validator.name || '—',
          formatXrd(validator.totalStakeXRD),
          `${validator.feePercent}%`,
          `${validator.apy?.toFixed(2)}%`,
          `${validator.uptimePercent}%`,
          validator.externalStakeAccepted ? 'yes' : 'no',
          validator.address,
        ]),
      ),
      cliNext([
        `Full dashboard with charts: ${ctx.origin}/en/dashboard`,
        `Stake from the console (wallet required): ${ctx.origin}/en/console/staking`,
        'Call lookup_entity with a validator address for its full on-ledger state.',
      ]),
    );
  },
});

export const getNetworkStatusTool = defineMcpTool({
  name: 'get_network_status',
  title: 'Get network status',
  description:
    'Current status of the Radix network: epoch, total XRD staked, number of active validators, average APY and average uptime.',
  category: 'ledger',
  inputSchema: z.object({ network: networkSchema }),
  handler: async ({ network }) => {
    const { networkStats } = (await getValidatorsCached(network)) as {
      networkStats: NetworkStats | null;
    };
    if (!networkStats) throw new Error(`Network stats unavailable for ${network}. Try again later.`);

    return cliRender(
      cliBanner('Network status'),
      cliKeyValues([
        ['Network', network],
        ['Epoch', networkStats.epoch],
        ['Round', networkStats.round],
        ['State version', networkStats.stateVersion],
        ['Total staked', formatXrd(networkStats.totalStaked)],
        ['Active validators', `${networkStats.activeValidators} of ${networkStats.totalValidators}`],
        ['Average APY', `${networkStats.avgApy?.toFixed(2)}%`],
        ['Average uptime', `${networkStats.avgUptime?.toFixed(2)}%`],
      ]),
    );
  },
});

export const getXrdPriceTool = defineMcpTool({
  name: 'get_xrd_price',
  title: 'Get XRD market data',
  description:
    'Live XRD market data from CoinGecko: price in USD and EUR, 24h change, market cap, circulating supply and total value locked.',
  category: 'ledger',
  inputSchema: z.object({}),
  handler: async () => {
    const market = await getMarketDataCached();
    if (!market) throw new Error('Market data unavailable right now. Try again later.');

    return cliRender(
      cliBanner('XRD market data'),
      cliKeyValues([
        ['Price', `$${market.priceUsd} / €${market.priceEur}`],
        ['24h change', `${market.priceChange24h.toFixed(2)}%`],
        ['Market cap', `$${Math.round(market.marketCapUsd).toLocaleString('en-US')}`],
        ['Circulating supply', formatXrd(market.circulatingSupply)],
        ['Total value locked', `$${Math.round(market.totalValueLockedUsd).toLocaleString('en-US')}`],
      ]),
    );
  },
});

export const getRecentTransactionsTool = defineMcpTool({
  name: 'get_recent_transactions',
  title: 'Get recent network transactions',
  description:
    'Latest committed transactions network-wide, newest first. Use get_transaction with an intent hash for the full breakdown of one of them.',
  category: 'ledger',
  inputSchema: z.object({
    network: networkSchema,
    limit: z.number().int().min(1).max(50).default(10).describe('Max transactions to return'),
  }),
  handler: async ({ network, limit }) => {
    const { transactions } = await getRecentTransactionsCached(undefined, limit, network);
    return cliRender(
      cliBanner('Recent transactions'),
      cliKeyValues([
        ['Network', network],
        ['Showing', Math.min(limit, transactions.length)],
      ]),
      transactionsTable(transactions.slice(0, limit)),
    );
  },
});

export const getAddressTransactionsTool = defineMcpTool({
  name: 'get_address_transactions',
  title: 'Get transactions of an address',
  description:
    'Transaction history of any entity (account, validator, component, resource), newest first. The first page already shows the most recent activity, which is what users almost always want. Accounts can have thousands of transactions: do NOT keep paging to the end — only fetch more pages (with the returned cursor) if the user explicitly asks for older history. Use get_transaction for the full breakdown of one of them.',
  category: 'ledger',
  inputSchema: z.object({
    address: addressSchema,
    network: networkSchema,
    limit: z.number().int().min(1).max(50).default(10).describe('Max transactions to return per page'),
    cursor: z
      .string()
      .max(5000)
      .optional()
      .describe('Pagination cursor from a previous call, to fetch the next (older) page'),
  }),
  handler: async ({ address, network, limit, cursor }) => {
    const { transactions, nextCursor } = await searchTransactionsByAddress(
      address,
      cursor,
      limit,
      network,
    );
    return cliRender(
      cliBanner('Address transactions'),
      cliKeyValues([
        ['Address', address],
        ['Network', network],
        ['Showing', transactions.length],
      ]),
      transactions.length > 0
        ? transactionsTable(transactions)
        : 'No transactions found. Check that the address belongs to the requested network (mainnet addresses contain "_rdx1", stokenet ones "_tdx_2_1").',
      nextCursor
        ? cliNext([
            'Older history exists. Present this page and STOP — do not page further on your own.',
            `Only if the user explicitly asks for older transactions, fetch the next page with get_address_transactions { "address": "${address}", "network": "${network}", "cursor": "${nextCursor}" }`,
          ])
        : undefined,
    );
  },
});

export const getNftDataTool = defineMcpTool({
  name: 'get_nft_data',
  title: 'Get NFT ids and data',
  description:
    'Explores a non-fungible resource (NFT collection): without "ids" it lists the local ids of the collection; with "ids" it returns the decoded on-ledger data (traits, fields) of those NFTs (max 10 per call).',
  category: 'ledger',
  inputSchema: z.object({
    resourceAddress: addressSchema.describe('Non-fungible resource address (resource_rdx1…)'),
    ids: z
      .array(z.string().max(200))
      .max(10)
      .optional()
      .describe('NFT local ids, e.g. ["#1#", "#2#"] or ["<member_1>"]. Omit to list the collection ids.'),
    network: networkSchema,
  }),
  handler: async ({ resourceAddress, ids, network }) => {
    if (!ids || ids.length === 0) {
      const { totalCount, ids: listed } = await fetchNonFungibleIds(resourceAddress, network);
      return cliRender(
        cliBanner('NFT collection ids'),
        cliKeyValues([
          ['Resource', resourceAddress],
          ['Network', network],
          ['Total NFTs', totalCount ?? 'unknown'],
          ['Listing', listed.length],
        ]),
        cliList(listed),
        'Call get_nft_data again with "ids" to read the data of specific NFTs.',
      );
    }

    const items = (await fetchNonFungibleDataCached(resourceAddress, ids, network)) as Array<
      Record<string, unknown>
    >;
    return cliRender(
      cliBanner('NFT data'),
      cliKeyValues([
        ['Resource', resourceAddress],
        ['Network', network],
      ]),
      ...items.map(
        (item) =>
          `${cliSection(String(item.non_fungible_id ?? '?'))}\n${cliCode(
            rawJson((item.data as Record<string, unknown>)?.programmatic_json ?? item),
            'json',
          )}`,
      ),
    );
  },
});

export const getResourceHoldersTool = defineMcpTool({
  name: 'get_resource_holders',
  title: 'Get top holders of a resource',
  description:
    'Lists the top holders of any token or NFT collection ordered by amount held, with the total holder count.',
  category: 'ledger',
  inputSchema: z.object({
    resourceAddress: addressSchema.describe('Resource address (resource_rdx1…)'),
    network: networkSchema,
  }),
  handler: async ({ resourceAddress, network }) => {
    const { totalCount, holders } = await fetchResourceHolders(resourceAddress, network);
    return cliRender(
      cliBanner('Resource holders'),
      cliKeyValues([
        ['Resource', resourceAddress],
        ['Network', network],
        ['Total holders', totalCount ?? 'unknown'],
        ['Showing', holders.length],
      ]),
      cliTable(
        ['#', 'Holder', 'Amount'],
        holders.map((holder, index) => [index + 1, holder.holderAddress, holder.amount]),
      ),
    );
  },
});

export const getComponentStateTool = defineMcpTool({
  name: 'get_component_state',
  title: 'Get decoded component state',
  description:
    'Live decoded on-ledger state of a component (oracle prices, pool reserves, configuration, …) plus its package and blueprint. For the callable methods use get_component_blueprint.',
  category: 'ledger',
  inputSchema: z.object({
    address: addressSchema.describe('Component address (component_rdx1… / pool_rdx1…)'),
    network: networkSchema,
  }),
  handler: async ({ address, network }) => {
    const details = (await fetchEntityDetails(address, network)) as Record<string, unknown>;
    const typed = details.details as Record<string, unknown> | undefined;
    if (!typed?.state) {
      throw new Error('This entity has no decoded component state. Use lookup_entity instead.');
    }

    return cliRender(
      cliBanner('Component state'),
      cliKeyValues([
        ['Component', address],
        ['Network', network],
        ['Package', typed.package_address as string | undefined],
        ['Blueprint', typed.blueprint_name as string | undefined],
        ['Blueprint version', typed.blueprint_version as string | undefined],
      ]),
      `${cliSection('Decoded state')}\n${cliCode(rawJson(typed.state), 'json')}`,
    );
  },
});

export const getKeyValueStoreTool = defineMcpTool({
  name: 'get_key_value_store',
  title: 'Read a key-value store',
  description:
    'Reads the entries of an on-ledger key-value store (component internal storage), decoded to JSON. KVS addresses appear inside component state as internal_keyvaluestore_….',
  category: 'ledger',
  inputSchema: z.object({
    address: z
      .string()
      .min(10)
      .max(120)
      .describe('Key-value store address (internal_keyvaluestore_…)'),
    network: networkSchema,
  }),
  handler: async ({ address, network }) => {
    const { totalKeys, entries } = await fetchKeyValueStoreEntries(address, network);
    return cliRender(
      cliBanner('Key-value store'),
      cliKeyValues([
        ['Store', address],
        ['Network', network],
        ['Total keys', totalKeys],
        ['Showing', entries.length],
      ]),
      ...entries.map(
        (entry, index) =>
          `${cliSection(`Entry ${index + 1}`)}\n${cliCode(
            rawJson({ key: entry.key, value: entry.value }),
            'json',
          )}`,
      ),
    );
  },
});

export const getComponentBlueprintTool = defineMcpTool({
  name: 'get_component_blueprint',
  title: 'Get blueprint interface',
  description:
    'Callable interface of a component or package blueprint: every function/method with its argument names and types. Pass a component address (the blueprint is resolved automatically) or a package address plus optional blueprintName.',
  category: 'ledger',
  inputSchema: z.object({
    address: addressSchema.describe('Component (component_rdx1…) or package (package_rdx1…) address'),
    blueprintName: z
      .string()
      .max(100)
      .optional()
      .describe('Blueprint name inside a package. Ignored for component addresses.'),
    network: networkSchema,
  }),
  handler: async ({ address, blueprintName, network }, ctx) => {
    let packageAddress = address;
    let resolvedBlueprint = blueprintName;

    if (!address.startsWith('package_')) {
      const details = (await fetchEntityDetails(address, network)) as Record<string, unknown>;
      const typed = details.details as Record<string, unknown> | undefined;
      if (!typed?.package_address) {
        throw new Error('This entity has no blueprint (not a component). Use lookup_entity instead.');
      }
      packageAddress = typed.package_address as string;
      resolvedBlueprint = typed.blueprint_name as string;
    }

    const blueprint = await fetchBlueprintInterface(packageAddress, resolvedBlueprint, network);
    if (!blueprint) throw new Error(`Blueprint not found in ${packageAddress}.`);

    return cliRender(
      cliBanner(`Blueprint · ${blueprint.blueprintName}`),
      cliKeyValues([
        ['Package', packageAddress],
        ['Blueprint', blueprint.blueprintName],
        ['Version', blueprint.version],
        ['Blueprints in package', blueprint.availableBlueprints.join(', ')],
      ]),
      `${cliSection('Functions & methods')}\n${cliList(
        blueprint.functions.map((fn) => {
          const args =
            fn.inputs === null
              ? '(raw args)'
              : `(${fn.inputs.map((input) => `${input.name}: ${input.typeHint}`).join(', ')})`;
          return `${fn.name}${args} — receiver: ${fn.receiver}`;
        }),
      )}`,
      cliNext([
        `Call these methods visually: ${ctx.origin}/en/console/component-panel`,
        'Build a call manifest with build_manifest_from_template or write it and check it with validate_transaction_manifest.',
      ]),
    );
  },
});

export const ledgerTools = [
  lookupEntityTool,
  getAccountBalancesTool,
  getTransactionTool,
  listValidatorsTool,
  getNetworkStatusTool,
  getXrdPriceTool,
  getRecentTransactionsTool,
  getAddressTransactionsTool,
  getNftDataTool,
  getResourceHoldersTool,
  getComponentStateTool,
  getKeyValueStoreTool,
  getComponentBlueprintTool,
];
