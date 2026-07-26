/**
 * services/gateway/entities.ts
 *
 * Gateway API calls for ledger state, entity metadata, and NFT data.
 * Used by: app/api/entity, app/api/nft-data, dashboard feature.
 */

import { getGateway, withRetry, type Network } from './client';
import logger from '@/lib/logger';
import { cacheTag, cacheLife } from 'next/cache';

/** Minimal shape returned by the Gateway for an entity detail response */
export type EntityDetailsResponse = unknown;

/** Minimal shape for a non-fungible ID item */
export type NonFungibleIdItem = unknown;

// ── Entity details ────────────────────────────────────────────────────────────

/**
 * Explicit metadata keys we always want for every resource.
 * The Gateway returns only a limited default page of metadata — tokens that
 * have more than ~3 keys (e.g. name + symbol + icon_url + description + tags)
 * would otherwise come back as "Unknown" because the remaining keys fall
 * outside the default page window.
 *
 * Requesting them explicitly via opt_ins.explicit_metadata guarantees all
 * keys in this list are included in the response regardless of page position.
 */
const RESOURCE_METADATA_KEYS = [
  'name',
  'symbol',
  'icon_url',
  'description',
  'tags',
  'info_url',
  'validator_fee_factor',
  'claim_epoch_delay',
  'dapp_definition',
  'dapp_definitions',
  'pool',
  'pool_address',
];

export async function fetchEntityDetails(
  address: string,
  network: Network = 'mainnet',
): Promise<EntityDetailsResponse | null> {
  "use cache";
  cacheLife("hours");
  cacheTag('entities', `entity-${address}`);

  const gateway = getGateway(network);
  try {
    const res = await withRetry(() =>
      gateway.state.innerClient.stateEntityDetails({
        stateEntityDetailsRequest: {
          addresses: [address],
          // Vault aggregation: amounts and NFT ids arrive inside vaults.items,
          // which mapHoldings and non_fungible_include_nfids depend on.
          aggregation_level: 'Vault',
          opt_ins: {
            explicit_metadata: RESOURCE_METADATA_KEYS,
            ancestor_identities: false,
            component_royalty_vault_balance: false,
            package_royalty_vault_balance: false,
            non_fungible_include_nfids: true,
          },
        },
      }),
    );
    const item = (res as { items?: unknown[] })?.items?.[0] ?? null;
    
    // SECURITY: Anti-Garbage protection.
    if (!item) {
      throw new Error(`Empty entity response for ${address} on ${network}`);
    }
    
    return item as EntityDetailsResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, 'Error fetching entity details: %s', message);
    throw error; // Re-throw to bypass cache
  }
}

/**
 * The entity payload an explorer CARD needs, in exactly the shape the client
 * fetcher produces.
 *
 * `fetchEntityDetails` above is not interchangeable with it: it asks for a
 * narrower set of opt-ins and returns the bare item, while the cards also read
 * `ledger_state` (for epoch maths) and the richer opt-ins. Hydrating a card's
 * query with that shape would half-fill it, and since the card's query uses
 * `staleTime: Infinity` the gap would never be repaired.
 *
 * This exists so an entity page can arrive with its card already resolved.
 * Without it the card had nothing to render on first paint, the transaction
 * list took the top of the grid, and the card then appeared above it and pushed
 * everything down. Requesting it here costs one cached gateway call and removes
 * that shift entirely.
 *
 * Keep the request body in step with `apiFetchEntityDetails` in
 * `features/dashboard/services/apiClient.ts`. They are two halves of one
 * contract: the server seeds the cache, the client reads it.
 */
export async function fetchEntityDetailsForCard(
  address: string,
  network: Network = 'mainnet',
): Promise<unknown | null> {
  "use cache";
  cacheLife("hours");
  cacheTag('entities', `entity-card-${address}`);

  const baseUrl =
    network === 'stokenet'
      ? 'https://gateway-stokenet.radix.community'
      : 'https://mainnet.radixdlt.com';

  try {
    const res = await withRetry(() =>
      fetch(`${baseUrl}/state/entity/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: [address],
          opt_ins: {
            explicit_metadata: [
              'name', 'symbol', 'icon_url', 'description', 'tags',
              'info_url', 'validator_fee_factor', 'claim_epoch_delay',
              'dapp_definition', 'dapp_definitions', 'pool', 'pool_address',
              'validator', 'claim_nft',
            ],
            ancestor_identities: false,
            component_royalty_vault_balance: false,
            package_royalty_vault_balance: false,
            non_fungible_include_nfids: true,
            dapp_two_way_links: true,
            native_resource_details: true,
          },
          aggregation_level: 'Vault',
        }),
      }),
    );

    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;

    // The client fetcher injects this, so the shapes must not diverge.
    item.ledger_state = data.ledger_state;
    return item;
  } catch (error) {
    // Non-fatal by design: the card falls back to fetching for itself.
    logger.error({ err: error }, '[Entities] Card prefetch failed for %s', address);
    return null;
  }
}

/**
 * Cached NFT metadata.
 */
export async function fetchNonFungibleDataCached(
    resourceAddress: string,
    localIds: string[],
    network: Network = 'mainnet',
): Promise<NonFungibleIdItem[]> {
    "use cache";
    cacheLife("minutes");
    cacheTag('nft', `nft-${resourceAddress}`);

    return fetchNonFungibleData(resourceAddress, localIds, network);
}

async function fetchNonFungibleData(
    resourceAddress: string,
    localIds: string[],
    network: Network = 'mainnet',
): Promise<NonFungibleIdItem[]> {
  const gateway = getGateway(network);
  try {
    const res = await withRetry(() =>
      gateway.state.innerClient.nonFungibleData({
        stateNonFungibleDataRequest: {
          resource_address: resourceAddress,
          non_fungible_ids: localIds.slice(0, 10),
        },
      }),
    );
    return ((res as { non_fungible_ids?: NonFungibleIdItem[] }).non_fungible_ids) || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, 'Error fetching NFT data: %s', message);
    return [];
  }
}
