/**
 * Per-entity page metadata: the reason entity routes exist at all.
 *
 * A query-parameter URL is one page as far as a search engine is concerned, so
 * the old `/dashboard?tx=…` could never be indexed per entity. With a path and
 * a real title, every resource, account, validator and transaction becomes its
 * own indexable page.
 *
 * Not every one of them should be in a search index, though. Accounts and
 * transactions are unbounded, nearly identical and about people, and anyone can
 * mint a resource called "Free XRD airdrop": letting all of it in would put
 * other people's text (scams included) on this domain and drown the pages that
 * matter. So only entities someone stands behind are indexable; the rest stay
 * fully reachable and shareable, just `noindex` (see `isEntityIndexable`).
 *
 * The gateway lookup behind this is already cached (`use cache` +
 * `cacheLife('hours')` in `fetchEntityDetailsForCard`), so generating metadata
 * does not add a round trip per request.
 */
import type { Metadata } from 'next';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { fetchEntityDetailsForCard } from '@/services/gateway/entities';
import { hasBaitName } from '../lib/validatorIndexing';
import { buildMetadata } from '@/lib/seo';
import type { Network } from '@/features/dashboard/types';
import type { EntityKind } from '../lib/routes';

interface MetadataItemLike {
  key: string;
  value?: { typed?: { value?: string } };
}

interface EntityDetailsLike {
  metadata?: { items?: MetadataItemLike[] };
  explicit_metadata?: { items?: MetadataItemLike[] };
  details?: {
    /** A resource's dApps that claim it back (both sides of the link agree). */
    two_way_linked_dapps?: { items?: unknown[] };
    /** A component's dApp, when that dApp claims it back. */
    two_way_linked_dapp_address?: string;
  };
}

const MAINNET_XRD = RADIX_TOKEN_ADDRESSES[RadixNetworkId.Mainnet]?.XRD;

/**
 * Whether an entity page belongs in a search index. Stokenet never (a test
 * ledger would duplicate every page); on mainnet:
 *
 *   • validators: yes, as before (the sitemap is where they are curated);
 *   • resources: XRD, or one whose dApp verifiably claims it (a two-way
 *     dApp link), and never one whose name is bait;
 *   • components: those a dApp verifiably claims;
 *   • accounts and transactions: never. They are people's, endless and
 *     nearly identical.
 */
export function isEntityIndexable(kind: EntityKind, network: Network, address: string, entity: EntityDetailsLike | null): boolean {
  if (network !== 'mainnet') return false;
  switch (kind) {
    case 'validator':
      return true;
    case 'resource': {
      if (hasBaitName(metadataValue(entity, 'name')) || hasBaitName(metadataValue(entity, 'symbol'))) return false;
      return address === MAINNET_XRD || (entity?.details?.two_way_linked_dapps?.items?.length ?? 0) > 0;
    }
    case 'component':
      return Boolean(entity?.details?.two_way_linked_dapp_address);
    default:
      return false;
  }
}

/** Reads a string metadata entry, preferring the explicitly requested set. */
function metadataValue(entity: EntityDetailsLike | null, key: string): string | undefined {
  const items = [
    ...(entity?.explicit_metadata?.items ?? []),
    ...(entity?.metadata?.items ?? []),
  ];
  return items.find((item) => item.key === key)?.value?.typed?.value || undefined;
}

/** `resource_rdx1abc…xyz` → `resource_rdx1abc…xyz` shortened for a title. */
function shorten(address: string): string {
  return address.length > 26 ? `${address.slice(0, 14)}…${address.slice(-6)}` : address;
}

/**
 * On-ledger `description` metadata is free-form and often long. Google shows
 * ~155 characters of a meta description, so anything past that is dead weight.
 * Cut on a word boundary rather than mid-word.
 */
function truncateDescription(text: string, limit = 155): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const KIND_LABEL: Record<EntityKind, string> = {
  tx: 'Transaction',
  resource: 'Resource',
  account: 'Account',
  validator: 'Validator',
  component: 'Component',
};

export interface EntityMetadataInput {
  locale: string;
  kind: EntityKind;
  address: string;
  network: Network;
  /** Canonical path of the page, without the locale prefix. */
  path: string;
  /** Site name appended to the title. */
  siteName: string;
}

/**
 * Builds the `Metadata` for an entity page.
 *
 * Whether the page may be indexed is `isEntityIndexable`'s call.
 */
export async function buildEntityMetadata({
  locale,
  kind,
  address,
  network,
  path,
  siteName,
}: EntityMetadataInput): Promise<Metadata> {
  const label = KIND_LABEL[kind];
  let title = `${label} ${shorten(address)}`;
  let description = `${label} ${address} on the Radix Network.`;

  // A transaction hash carries no metadata; everything else may have a name.
  let entity: EntityDetailsLike | null = null;
  if (kind !== 'tx') {
    entity = (await fetchEntityDetailsForCard(address, network).catch(() => null)) as EntityDetailsLike | null;
    const name = metadataValue(entity, 'name');
    const symbol = metadataValue(entity, 'symbol');
    const about = metadataValue(entity, 'description');

    if (name) {
      title = symbol ? `${name} (${symbol})` : name;
      description = about
        ? truncateDescription(about)
        : `${label} ${name} on the Radix Network.`;
    }
  }

  const indexable = isEntityIndexable(kind, network, address, entity);

  return buildMetadata({
    locale,
    pathname: path,
    title: `${title} · ${siteName}`,
    description,
    noIndex: !indexable,
  });
}
