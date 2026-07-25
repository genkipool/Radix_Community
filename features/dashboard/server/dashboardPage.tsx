/**
 * The dashboard's server-side work, in one place.
 *
 * Both dashboard routes (`/staking` and `/explorer`) render the same client and
 * need the same server preparation: session, network resolution, timezone,
 * cookie-persisted preferences and the React Query prefetch. Keeping that here
 * means a route file is a handful of lines, and adding a view later is a new
 * folder plus one call rather than another copy of 250 lines of setup.
 *
 * The view is a PARAMETER, not something inferred from query params: the route
 * decides it, which is the whole point of the path-based URLs.
 */
import { cookies, headers } from 'next/headers';
import { dehydrate } from '@tanstack/react-query';
import { ReactQueryHydrate } from '@/components/layout/ReactQueryHydrate';
import {
  getValidatorsCached,
  getRecentTransactionsCached,
  fetchFilteredTransactions,
  searchTransactionsByAddress,
  type Validator,
  type NetworkStats,
} from '@/services/radixApi';
import type { TransactionInfo } from '@/types/radix';
import { getMarketDataCached } from '@/services/marketData';
import DashboardClient from '@/features/dashboard/DashboardClient';
import { getNetworkCookieKey } from '@/features/dashboard/utils/cookieUtils';
import { makeQueryClient } from '@/lib/queryClient';
import logger from '@/lib/logger';
import { validateTxHash, validateAddress } from '@/utils/apiValidation';
import { COOKIE_KEYS } from '@/constants/dashboard';
import { getSessionFromCookies } from '@/lib/auth/session';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import type { Network, SortMode, DashboardView } from '@/features/dashboard/types';
import { parseDashboardQuery, type RawSearchParams } from '../lib/routes';

/** Dictionaries every dashboard route needs. */
const DASHBOARD_NAMESPACES = [
  'dashboard',
  'dashboardStaking',
  'dashboardExplorador',
] as const;

export function getDashboardDictionary(locale: string) {
  return getFeatureDictionary(locale as Locale, [...DASHBOARD_NAMESPACES]);
}

/* ── Cookie helpers ───────────────────────────────────────────────────────── */

function makeCookieReader(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const get = (name: string) => cookieStore.get(name)?.value;
  const decoded = (name: string) => {
    const v = get(name);
    try {
      return v ? decodeURIComponent(v) : undefined;
    } catch {
      return v;
    }
  };
  const int = (name: string, fb: number) => {
    const n = parseInt(get(name) ?? '', 10);
    return isNaN(n) ? fb : n;
  };
  const bool = (name: string) => get(name) === 'true';
  const ids = (name: string, network?: string) => {
    const key = network ? getNetworkCookieKey(name, network) : name;
    const raw = decoded(key);
    return raw ? raw.split(',').filter(Boolean) : [];
  };
  const sort = (name: string): SortMode => {
    const raw = get(name);
    return (['newest', 'oldest', 'date', 'random'] as const).includes(raw as SortMode)
      ? (raw as SortMode)
      : 'random';
  };
  return { get, decoded, int, bool, ids, sort };
}

/**
 * Active network: an explicit choice in the URL wins, then the wallet session,
 * then the last-used cookie, then mainnet.
 */
function resolveNetwork(
  fromUrl: Network | undefined,
  cookieValue: string | undefined,
  session: { mainnet?: unknown; stokenet?: unknown } | null,
): Network {
  if (fromUrl) return fromUrl;
  const preferred = cookieValue === 'stokenet' ? 'stokenet' : 'mainnet';
  if (session?.mainnet && session?.stokenet) return preferred;
  if (session?.mainnet) return 'mainnet';
  if (session?.stokenet) return 'stokenet';
  return preferred;
}

const EMPTY_NETWORK_STATS: NetworkStats = {
  totalStaked: 0,
  activeValidators: 0,
  totalValidators: 0,
  avgApy: 0,
  avgUptime: 0,
  epoch: 0,
};

/* ── Page shell ───────────────────────────────────────────────────────────── */

export interface DashboardPageShellProps {
  locale: string;
  /** Decided by the route, not by query params. */
  view: DashboardView;
  searchParams: RawSearchParams;
}

export async function DashboardPageShell({
  locale,
  view,
  searchParams,
}: DashboardPageShellProps) {
  const [cookieStore, headerStore, t] = await Promise.all([
    cookies(),
    headers(),
    getDashboardDictionary(locale),
  ]);

  const query = parseDashboardQuery(searchParams);
  const c = makeCookieReader(cookieStore);
  const session = await getSessionFromCookies();
  const network = resolveNetwork(query.network, c.get('radix_active_network'), session);

  const isServerWalletConnected = !!session?.[network];
  const initialConnectedAccounts =
    session?.[network]?.accounts?.map((a) => a.address) || [];

  // Timezone: cookie, then geo header, then the server's own zone.
  const clientTz = c.decoded('client-tz');
  const country =
    headerStore.get('cf-ipcountry') || headerStore.get('x-vercel-ip-country');
  const timezone =
    clientTz ||
    (country === 'ES' ? 'Europe/Madrid' : Intl.DateTimeFormat().resolvedOptions().timeZone);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Stable for the whole day, so the "random" ordering does not reshuffle on
  // every render and break hydration.
  const randomSeed = Math.floor(startOfDay / (1000 * 60 * 60));

  // Tag: the URL wins over the cookie, and the parser already rejected unknown
  // values, so no second validation list is needed here.
  const activeTxTag = query.tag ?? c.decoded(COOKIE_KEYS.txTag) ?? 'All';

  // The focused entity is re-validated with the shared validators, so a value
  // that only *looks* like an address never reaches the gateway.
  const entity = query.entity
    ? (validateAddress(query.entity) ?? validateTxHash(query.entity))
    : null;

  const dateRange = { start: query.start ?? null, end: query.end ?? null };
  const serverQueryClient = makeQueryClient();
  const marketDataPromise = getMarketDataCached();

  // Each route ships ONLY what it renders. Before the views were split they
  // shared one page, so both data sets travelled together: staking carried 100
  // transactions it never shows, and the explorer 287 validator objects it uses
  // for nothing but four aggregate figures (now passed as `networkStats`).
  const showsTransactions = view === 'transactions';
  let networkStats: NetworkStats = EMPTY_NETWORK_STATS;

  try {
    // Aggregates are needed by BOTH views (the header shows them), but only the
    // staking view needs the list behind them in its cache.
    const validatorsData = await getValidatorsCached(network);
    networkStats = validatorsData?.networkStats ?? EMPTY_NETWORK_STATS;

    if (!showsTransactions) {
      serverQueryClient.setQueryData(['validators', network], {
        validators: validatorsData?.validators ?? ([] as Validator[]),
        networkStats,
      });
    }

    if (showsTransactions) {
      // First page of transactions, by decreasing specificity.
      const txData = await (async () => {
        if (entity) {
          const data = await searchTransactionsByAddress(entity, undefined, 15, network);
          return { transactions: data.transactions, nextCursor: data.nextCursor };
        }
        if (dateRange.start || dateRange.end) {
          const data = await fetchFilteredTransactions({
            tag: activeTxTag,
            start: dateRange.start,
            end: dateRange.end,
            limit: 15,
            network,
            timezone,
          });
          return { transactions: data.transactions, nextCursor: data.nextCursor };
        }
        if (activeTxTag !== 'All') {
          const data = await fetchFilteredTransactions({
            tag: activeTxTag,
            limit: 15,
            network,
            timezone,
          });
          return { transactions: data.transactions, nextCursor: data.nextCursor };
        }
        const data = await getRecentTransactionsCached(undefined, 100, network);
        return {
          transactions: (data?.transactions ?? []) as TransactionInfo[],
          nextCursor: data?.nextCursor ?? undefined,
        };
      })();

      // Seed the infinite query with what we just fetched. Proposer display data
      // is enriched at the service layer, so no per-request lookup map is needed.
      serverQueryClient.setQueryData(
        ['transactions', network, entity ?? undefined, activeTxTag, dateRange],
        { pages: [txData], pageParams: [undefined] },
      );
    }

    // Deep entity metadata is deliberately NOT hydrated here: cards fetch their
    // own icons and symbols on the client, keeping CPU and TTFB down.
  } catch (error) {
    // Non-fatal: the client fetches on mount when the cache is empty.
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, '[DashboardPage] Failed to prefetch data: %s', message);
  }

  const marketData = await marketDataPromise;

  return (
    <ReactQueryHydrate state={dehydrate(serverQueryClient)}>
      <DictionaryEnricher partial={t} />
      <DashboardClient
        timezone={timezone}
        initialView={view}
        initialNetwork={network}
        initialActiveTag={
          c.ids(COOKIE_KEYS.activeTag).length > 0 ? c.ids(COOKIE_KEYS.activeTag) : ['All']
        }
        initialTransactionActiveTag={activeTxTag}
        initialValSortMode={c.sort(COOKIE_KEYS.valSortMode)}
        initialTxSortMode={c.sort(COOKIE_KEYS.txSortMode)}
        initialValColumns={c.int(COOKIE_KEYS.valColumns, 2)}
        initialTxColumns={c.int(COOKIE_KEYS.txColumns, 1)}
        initialValReadingMode={c.bool(COOKIE_KEYS.valReadingMode)}
        initialTxReadingMode={c.bool(COOKIE_KEYS.txReadingMode)}
        initialValAutoCollapse={c.bool(COOKIE_KEYS.valAutoCollapse)}
        initialTxAutoCollapse={c.bool(COOKIE_KEYS.txAutoCollapse)}
        initialNetworkStats={networkStats}
        initialNetworkFromUrl={!!query.network}
        initialWalletFilter={
          // Default ON for a connected wallet, matching the previous behaviour;
          // once the user has chosen, their cookie decides.
          cookieStore.get(COOKIE_KEYS.walletFilter)?.value !== 'false'
        }
        initialSearchQuery={entity ?? ''}
        initialDateRange={dateRange}
        randomSeed={randomSeed}
        initialMarketData={marketData}
        dictionary={t}
        initialIsWalletConnected={isServerWalletConnected}
        initialConnectedAccounts={initialConnectedAccounts}
      />
    </ReactQueryHydrate>
  );
}
