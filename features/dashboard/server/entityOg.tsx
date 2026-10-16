/**
 * Share cards for the explorer's entity pages: an account, a resource, a
 * transaction.
 *
 * As with the validator card, a name alone says little (and on-ledger names
 * are written by anyone), so each card carries figures read from the ledger:
 * what an account holds, how much of a resource exists, how a transaction
 * ended. The network comes from the address itself, so a Stokenet link gets
 * a Stokenet card. A card never fails a request: an unknown or unreachable
 * entity still gets one, without the figures.
 */
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { mapHoldings } from '@/features/console/lib/account-holdings';
import { getMetadataString, type GatewayMetadataItem } from '@/features/console/lib/metadata-manifests';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { ogCard, OG_SIZE, OG_CONTENT_TYPE, type OgStat } from '@/lib/og-card';
import logger from '@/lib/logger';
import { fetchEntityDetailsForCard } from '@/services/gateway/entities';
import { fetchTransactionDetails } from '@/services/gateway/transactions';
import { networkOfAddress } from '../lib/routes';

export const entityOgConfig = { size: OG_SIZE, contentType: OG_CONTENT_TYPE, alt: 'Radix Community' };

type CardKind = 'account' | 'resource' | 'tx';

const shorten = (address: string) => (address.length > 26 ? `${address.slice(0, 14)}…${address.slice(-6)}` : address);

const compact = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Never let a share card fail the request it belongs to. */
async function safely<T>(what: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    logger.error({ err: error }, '[og:%s] Failed to read the ledger', what);
    return null;
  }
}

interface EntityLike {
  metadata?: { items?: GatewayMetadataItem[] };
  explicit_metadata?: { items?: GatewayMetadataItem[] };
  details?: { type?: string; total_supply?: string; divisibility?: number };
}

const meta = (entity: EntityLike | null, key: string) =>
  getMetadataString(entity?.explicit_metadata?.items, key) || getMetadataString(entity?.metadata?.items, key);

/** The share card's renderer for one kind of entity page. */
export function entityOgImage(kind: CardKind) {
  return async function Image({ params }: { params: Promise<{ locale: string; address: string }> }) {
    const { locale, address: raw } = await params;
    const address = decodeURIComponent(raw);
    const network = networkOfAddress(address) ?? 'mainnet';
    const t = await getFeatureDictionary(locale as Locale, ['dashboard']);
    const og = t.dashboard.og;
    const testnet = network === 'stokenet' ? og.stokenet : undefined;

    if (kind === 'tx') {
      const tx = (await safely('tx', () => fetchTransactionDetails(address, network))) as {
        transaction_status?: string;
        fee_paid?: string;
        confirmed_at?: string;
        message?: { content?: { value?: string } };
      } | null;
      if (!tx) return ogCard({ title: og.tx_title, subtitle: shorten(address), badge: testnet });
      const status = tx.transaction_status === 'CommittedSuccess' ? og.tx_success : og.tx_failed;
      const stats: OgStat[] = [{ label: og.status, value: status }];
      if (tx.fee_paid) stats.push({ label: og.fee, value: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(tx.fee_paid))} XRD` });
      if (tx.confirmed_at) {
        stats.push({ label: og.date, value: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(tx.confirmed_at)) });
      }
      return ogCard({ title: og.tx_title, subtitle: shorten(address), stats, badge: testnet });
    }

    const entity = (await safely(kind, () => fetchEntityDetailsForCard(address, network))) as EntityLike | null;
    const name = meta(entity, 'name');
    const symbol = meta(entity, 'symbol');

    if (kind === 'account') {
      const stats: OgStat[] = [];
      if (entity) {
        const holdings = mapHoldings(entity as Record<string, unknown>);
        const xrd = RADIX_TOKEN_ADDRESSES[network === 'stokenet' ? RadixNetworkId.Stokenet : RadixNetworkId.Mainnet]?.XRD;
        const xrdAmount = Number(holdings.fungibles.find((f) => f.resourceAddress === xrd)?.amount ?? 0);
        stats.push(
          { label: 'XRD', value: compact(xrdAmount, locale) },
          { label: og.tokens, value: String(holdings.fungibles.filter((f) => Number(f.amount) > 0).length) },
          { label: og.nft_collections, value: String(holdings.nonFungibles.filter((n) => n.ids.length > 0).length) },
        );
      }
      return ogCard({ title: name || shorten(address), subtitle: name ? `${og.account} · ${shorten(address)}` : og.account, stats, badge: testnet });
    }

    // Resource
    const isNft = entity?.details?.type === 'NonFungibleResource';
    const stats: OgStat[] = [{ label: og.type, value: isNft ? og.nft : og.token }];
    if (entity?.details?.total_supply) {
      stats.push({ label: isNft ? og.minted : og.supply, value: compact(Number(entity.details.total_supply), locale) });
    }
    if (!isNft && typeof entity?.details?.divisibility === 'number') {
      stats.push({ label: og.decimals, value: String(entity.details.divisibility) });
    }
    const title = name ? (symbol ? `${name} (${symbol})` : name) : symbol || shorten(address);
    return ogCard({ title, subtitle: meta(entity, 'description') || shorten(address), stats, badge: testnet });
  };
}
