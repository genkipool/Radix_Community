import { cookies, headers } from 'next/headers';
import { dehydrate } from '@tanstack/react-query';
import { ReactQueryHydrate } from '@/components/layout/ReactQueryHydrate';
import {
  getValidatorsCached,
  getRecentTransactionsCached,
  fetchFilteredTransactions,
  searchTransactionsByAddress,
  type Validator, type NetworkStats,
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

import type { Network, SortMode, DashboardView } from '@/features/dashboard/types';
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { DictionaryEnricher } from '@/context/LanguageContext';
import { buildAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, ['dashboard', 'dashboardStaking', 'dashboardExplorador']);
  return {
    title: t.seo.dashboard.title,
    description: t.seo.dashboard.description,
    alternates: buildAlternates(locale, '/dashboard'),
  };
}

// All heavy data fetches are cached globally via centralized service wrappers.
export const dynamic = 'force-dynamic';

// ── Cookie helpers (server-side) ───────────────────────────────
function makeCookieReader(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const get = (name: string) => cookieStore.get(name)?.value;
  const decoded = (name: string) => {
    const v = get(name);
    try { return v ? decodeURIComponent(v) : undefined; } catch { return v; }
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

// ── Page ───────────────────────────────────────────────────────
interface DashboardPageProps {
  searchParams: Promise<{
    view?: string;
    network?: string;
    tx?: string;
    start?: string;
    end?: string;
    tag?: string;
  }>;
  params: Promise<{
    locale: string;
  }>;
}


/**
 * DashboardPage — Server Component
 *
 * Pre-populates the React Query cache via HydrationBoundary so that
 * DashboardClient's useValidatorsQuery / useTransactionsQuery instantly
 * read from cache — no loading state, no waterfall.
 *
 * All cookie-persisted button states are read here and forwarded as props
 * so the server render matches the user's last session exactly.
 */
export default async function DashboardPage({ searchParams, params }: DashboardPageProps) {
  const p = await params;
  const locale = p.locale;
  const [searchParamsResolved, cookieStore, headerStore, t] = await Promise.all([
    searchParams,
    cookies(),
    headers(),
    getFeatureDictionary(locale as Locale, ['dashboard', 'dashboardStaking', 'dashboardExplorador'])
  ]);
  const initialView = (searchParamsResolved.view === 'transactions' || searchParamsResolved.tx) ? 'transactions' : 'staking';
  // Parse date range from URL params
  const start = searchParamsResolved.start || null;
  const end = searchParamsResolved.end || null;
  const initialDateRange = { start, end };
  const c = makeCookieReader(cookieStore);

  // Read wallet session
  const session = await getSessionFromCookies();

  // Determine active network
  let network: Network;
  if (searchParamsResolved.network === 'stokenet' || searchParamsResolved.network === 'mainnet') {
    network = searchParamsResolved.network as Network;
  } else {
    const activeNetworkCookie = c.get('radix_active_network');
    if (session?.mainnet && session?.stokenet) {
      network = activeNetworkCookie === 'stokenet' ? 'stokenet' : 'mainnet';
    } else if (session?.mainnet) {
      network = 'mainnet';
    } else if (session?.stokenet) {
      network = 'stokenet';
    } else {
      network = activeNetworkCookie === 'stokenet' ? 'stokenet' : 'mainnet';
    }
  }

  const isServerWalletConnected = !!session?.[network];
  const initialConnectedAccounts = session?.[network]?.accounts?.map(a => a.address) || [];

  // Timezone resolution: Cookie > Geo Fallback > UTC
  const clientTz = c.decoded('client-tz');
  const country = headerStore.get('cf-ipcountry') || headerStore.get('x-vercel-ip-country');
  const timezone = clientTz || (country === 'ES' ? 'Europe/Madrid' : Intl.DateTimeFormat().resolvedOptions().timeZone);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const randomSeed = Math.floor(startOfDay / (1000 * 60 * 60)); // Stable for the entire day

  const emptyNetworkStats: NetworkStats = {
    totalStaked: 0, activeValidators: 0, totalValidators: 0,
    avgApy: 0, avgUptime: 0, epoch: 0,
  };

  // Pre-populate React Query cache server-side
  const serverQueryClient = makeQueryClient();

  // Read transaction tag: URL param takes priority, then cookie, then default
  const VALID_TX_TAGS = ['All', 'Success', 'Failed', 'With Message', 'With NFTs'];
  const urlTag = searchParamsResolved.tag ? decodeURIComponent(searchParamsResolved.tag) : null;
  const cookieTag = c.decoded(COOKIE_KEYS.txTag) ?? 'All';
  const activeTxTag = urlTag && VALID_TX_TAGS.includes(urlTag) ? urlTag : cookieTag;

  // If a validator modal is open (restored from cookie), prefetch its stake
  // history so SSR and first client render have identical data — no hydration
  // mismatch and no spinner flash on reload.
  // Read transaction ID or Account Address from URL
  const txid = searchParamsResolved.tx ? (validateAddress(searchParamsResolved.tx) || validateTxHash(searchParamsResolved.tx)) : null;

  // Launch marketData early — runs independently of validator/transaction prefetch
  const marketDataPromise = getMarketDataCached();

  try {
    // 1. Fetch the first page of transactions explicitly so we can scan it for resources
    const txData = await (async () => {
      // Priority 1: Direct transaction ID lookup (Search)
      if (txid) {
        const data = await searchTransactionsByAddress(txid, undefined, 15, network);
        return { transactions: data.transactions, nextCursor: data.nextCursor };
      }

      // Priority 2: Custom date range (Calendar)
      if (initialDateRange.start || initialDateRange.end) {
        const data = await fetchFilteredTransactions({
          tag: activeTxTag,
          start: initialDateRange.start,
          end: initialDateRange.end,
          limit: 15,
          network,
          timezone,
        });
        return { transactions: data.transactions, nextCursor: data.nextCursor };
      }

      // Priority 3: Tag filter OR default "All" view
      if (activeTxTag !== 'All') {
        // Server fetches filtered data so client renders immediately with correct filter
        const data = await fetchFilteredTransactions({
          tag: activeTxTag,
          limit: 15,
          network,
          timezone,
        });
        return { transactions: data.transactions, nextCursor: data.nextCursor };
      }

      // Default: Redis cached tip (all transactions)
      const data = await getRecentTransactionsCached(undefined, 100, network);
      return {
        transactions: (data?.transactions ?? []) as TransactionInfo[],
        nextCursor: data?.nextCursor ?? undefined,
      };
    })();


    // ── PHASE 1: Critical data (must complete before render) ──────────────
    const txQueryKey = ['transactions', network, txid ?? undefined, activeTxTag, initialDateRange];

    await serverQueryClient.prefetchQuery({
      queryKey: ['validators', network],
      queryFn: async () => {
        const data = await getValidatorsCached(network);
        return {
          validators: data?.validators ?? [] as Validator[],
          networkStats: data?.networkStats ?? emptyNetworkStats,
        };
      },
      staleTime: 300_000,
    });

    // Seed the infinite query cache with the transaction data we just fetched.
    // Proposer display data (name/icon/address) is already enriched at the
    // service layer via enrichTransactionsProposerInfo() when transactions
    // are cached to Redis, so no per-request lookup map is needed here.
    serverQueryClient.setQueryData(txQueryKey, {
      pages: [txData],
      pageParams: [undefined],
    });

    // ── PHASE 2: Client-Side Hydration ────────────────────────────────────────
    // We intentionally avoid deep entity metadata hydration on the server to 
    // minimize CPU usage and TTFB. Transaction cards and validator cards in 
    // DashboardClient will fetch their own metadata (icons, symbols) on the 
    // client via useQuery if not found in the initial cache.
  } catch (error) {
    // Non-fatal: the client fetches on mount if cache is empty
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, '[DashboardPage] Failed to prefetch data: %s', message);
  }

  // Await the marketData promise launched in parallel during PHASE 1
  const marketData = await marketDataPromise;

  return (
    <ReactQueryHydrate state={dehydrate(serverQueryClient)}>
      <DictionaryEnricher partial={t} />
      <DashboardClient
        timezone={timezone}
        initialView={initialView as DashboardView}
        initialNetwork={network}
        initialActiveTag={c.ids(COOKIE_KEYS.activeTag).length > 0 ? c.ids(COOKIE_KEYS.activeTag) : ['All']}
        initialTransactionActiveTag={activeTxTag}
        initialValSortMode={c.sort(COOKIE_KEYS.valSortMode)}
        initialTxSortMode={c.sort(COOKIE_KEYS.txSortMode)}
        initialValColumns={c.int(COOKIE_KEYS.valColumns, 2)}
        initialTxColumns={c.int(COOKIE_KEYS.txColumns, 1)}
        initialValReadingMode={c.bool(COOKIE_KEYS.valReadingMode)}
        initialTxReadingMode={c.bool(COOKIE_KEYS.txReadingMode)}
        initialValAutoCollapse={c.bool(COOKIE_KEYS.valAutoCollapse)}
        initialTxAutoCollapse={c.bool(COOKIE_KEYS.txAutoCollapse)}
        initialSearchQuery={txid ?? ''}
        initialDateRange={initialDateRange}
        randomSeed={randomSeed}
        initialMarketData={marketData}
        dictionary={t}
        initialIsWalletConnected={isServerWalletConnected}
        initialConnectedAccounts={initialConnectedAccounts}
      />

    </ReactQueryHydrate>
  );
}
