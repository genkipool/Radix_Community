/**
 * services/gateway/entities.ts
 *
 * Gateway API calls for ledger state, entity metadata, and NFT data.
 * Used by: app/api/entity, app/api/nft-data, dashboard feature.
 */

import { getGateway, withRetry, type Network } from './client';
import logger from '@/lib/logger';

/** Minimal shape returned by the Gateway for an entity detail response */
export type EntityDetailsResponse = unknown;

/** Minimal shape for a non-fungible ID item */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NonFungibleIdItem = any;

// ── Ledger state ──────────────────────────────────────────────────────────────
export async function fetchLedgerState(network: Network = 'mainnet') {
  const gateway = getGateway(network);
  try {
    const res = await withRetry(() => gateway.status.getCurrent());
    return res.ledger_state;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, 'Error fetching ledger state: %s', message);
    return null;
  }
}

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
];

export async function fetchEntityDetails(
  address: string,
  network: Network = 'mainnet',
): Promise<EntityDetailsResponse | null> {
  const gateway = getGateway(network);
  try {
    // Use innerClient directly so we can pass opt_ins.explicit_metadata.
    // getEntityDetailsVaultAggregated() is a convenience wrapper that does not
    // forward opt_ins, so tokens with many metadata keys (DFP2, etc.) would
    // only return the first page of metadata — showing as "Unknown" in the UI.
    const res = await withRetry(() =>
      gateway.state.innerClient.stateEntityDetails({
        stateEntityDetailsRequest: {
          addresses: [address],
          opt_ins: {
            explicit_metadata: RESOURCE_METADATA_KEYS,
            ancestor_identities: false,
            component_royalty_vault_balance: false,
            package_royalty_vault_balance: false,
            non_fungible_include_nfids: false,
          },
        },
      }),
    );
    // The response is a list; extract the first (and only) item
    const item = (res as { items?: unknown[] })?.items?.[0] ?? null;
    return item as EntityDetailsResponse | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, 'Error fetching entity details: %s', message);
    return null;
  }
}

// ── NFT data ──────────────────────────────────────────────────────────────────
export async function fetchNonFungibleData(
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

export async function fetchNonFungibleLocation(
  resourceAddress: string,
  localIds: string[],
  network: Network = 'mainnet',
): Promise<NonFungibleIdItem[]> {
  const gateway = getGateway(network);
  try {
    const res = await withRetry(() =>
      gateway.state.innerClient.nonFungibleLocation({
        stateNonFungibleLocationRequest: {
          resource_address: resourceAddress,
          non_fungible_ids: localIds,
        },
      }),
    );
    return ((res as { non_fungible_ids?: NonFungibleIdItem[] }).non_fungible_ids) || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, 'Error fetching NFT location: %s', message);
    return [];
  }
}
