/**
 * Per-entity page metadata: the reason entity routes exist at all.
 *
 * A query-parameter URL is one page as far as a search engine is concerned, so
 * the old `/dashboard?tx=…` could never be indexed per entity. With a path and
 * a real title, every resource, account, validator and transaction becomes its
 * own indexable page.
 *
 * The gateway lookup behind this is already cached (`use cache` +
 * `cacheLife('hours')` in `fetchEntityDetails`), so generating metadata does
 * not add a round trip per request.
 */
import type { Metadata } from 'next';
import { fetchEntityDetails } from '@/services/radixApi';
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
 * Only mainnet is indexable: Stokenet is a test ledger, and letting it into the
 * index would create a near-duplicate of every page and split their ranking.
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
  if (kind !== 'tx') {
    const entity = (await fetchEntityDetails(address, network).catch(
      () => null,
    )) as EntityDetailsLike | null;
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

  const indexable = network === 'mainnet';

  return buildMetadata({
    locale,
    pathname: path,
    title: `${title} · ${siteName}`,
    description,
    noIndex: !indexable,
  });
}
