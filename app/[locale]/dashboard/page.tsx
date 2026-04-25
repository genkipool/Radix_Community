import { cookies, headers } from 'next/headers';
import { dehydrate } from '@tanstack/react-query';
import { ReactQueryHydrate } from '@/components/layout/ReactQueryHydrate';
import {
  getValidatorsCached,
  getRecentTransactionsCached,
  fetchStakeHistoryCached,
  fetchFilteredTransactions,
  searchTransactionsByAddress, fetchEntityDetails,
  type Validator, type NetworkStats,
} from '@/services/radixApi';
import type { TransactionInfo } from '@/types/radix';
import { getMarketDataCached } from '@/services/marketData';
import DashboardClient from '@/features/dashboard/DashboardClient';
import { DashboardStatsRow } from '@/features/dashboard/components/DashboardStatsRow';
import { entityKeys, extractEntityMeta, normalizeAddress, needsFetch } from '@/features/dashboard/utils/entityCache';
import { getNetworkCookieKey } from '@/features/dashboard/utils/cookieUtils';
import { makeQueryClient } from '@/lib/queryClient';
import logger from '@/lib/logger';
import { validateTxHash } from '@/utils/apiValidation';
import { COOKIE_KEYS } from '@/constants/dashboard';

import type { Network, SortMode, DashboardView } from '@/features/dashboard/types';
import { getDictionary, type Locale } from '@/i18n/dictionaries';
import { buildAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getDictionary(locale as Locale);
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
export default async function DashboardPage({ searchParams, params }: {
  searchParams: Promise<{
    view?: string;
    network?: string;
    tx?: string;
    start?: string;
    end?: string;
    tag?: string;
  }>;
  params: Promise<{ locale: string }>;
}) {
  const { view: pView, network: pNetwork, tx: pTx, start: pStart, end: pEnd, tag: pTag } = await searchParams;
  const { locale } = await params;
  const initialView = (pView === 'transactions' || pTx) ? 'transactions' : 'staking';
  const network = (pNetwork === 'stokenet' ? 'stokenet' : 'mainnet') as Network;

  // Parse date range from URL params
  const initialDateRange = { start: pStart || null, end: pEnd || null };

  const dictionary = await getDictionary(locale as Locale);
  const dt = dictionary.dashboard ?? {};

  // Read all persisted UI state from cookies
  const cookieStore = await cookies();
  const headerStore = await headers();
  const c = makeCookieReader(cookieStore);

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
  const activeTxTag = (pTag && VALID_TX_TAGS.includes(decodeURIComponent(pTag))) 
    ? decodeURIComponent(pTag) 
    : (c.decoded(COOKIE_KEYS.txTag) ?? 'All');

  const txid = pTx ? validateTxHash(pTx) : null;
  const initialExpandedTxs = txid && txid.startsWith('txid_') ? [txid] : c.ids(COOKIE_KEYS.expandedTxs, network);
  const expandedValidatorIds = c.ids(COOKIE_KEYS.expandedValidators, network);

  let realValidators: Validator[] = [];
  let networkStats: NetworkStats | null = null;

  try {
    const vData = await getValidatorsCached(network);
    realValidators = vData?.validators ?? [];
    networkStats = vData?.networkStats ?? null;

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

    const txQueryKey = ['transactions', network, txid ?? undefined, activeTxTag, initialDateRange];

    await serverQueryClient.prefetchQuery({
      queryKey: ['validators', network],
      queryFn: async () => ({
        validators: realValidators,
        networkStats: networkStats ?? emptyNetworkStats,
      }),
      staleTime: 300_000,
    });

    serverQueryClient.setQueryData(txQueryKey, {
      pages: [txData],
      pageParams: [undefined],
    });

    // Proposer enrichment
    if (realValidators.length) {
      const proposerMap: Record<string, { name: string; iconUrl: string; address: string }> = {};
      for (const v of realValidators) {
        if (v.rank > 0) proposerMap[String(v.rank)] = { name: v.name, iconUrl: v.iconUrl || '', address: v.address };
      }
      txData.transactions.forEach((tx: TransactionInfo) => {
        if (tx.proposerInfo && !tx.proposerInfo.name) {
          const entry = proposerMap[String(tx.proposerInfo.rank)];
          if (entry) {
            tx.proposerInfo.name = entry.name;
            tx.proposerInfo.iconUrl = entry.iconUrl;
            tx.proposerInfo.address = entry.address;
          }
        }
      });
      serverQueryClient.setQueryData(txQueryKey, { pages: [txData], pageParams: [undefined] });
    }

    // Best-effort hydration for sub-resources
    await Promise.allSettled([
      (async () => {
        const discovered = new Set<string>();
        txData.transactions.forEach((tx: TransactionInfo) => {
          if (tx.displayResource && tx.displayResource !== 'XRD') discovered.add(tx.displayResource);
          if (tx.validatorAddress) discovered.add(tx.validatorAddress);
        });
        const toFetch = Array.from(discovered).filter(addr => needsFetch(normalizeAddress(addr)));
        await Promise.all(toFetch.map(async (addr) => {
          try {
            const ent = await fetchEntityDetails(addr, network);
            if (ent) {
              const clean = normalizeAddress(addr);
              serverQueryClient.setQueryData(entityKeys.detail(clean, network), extractEntityMeta(ent));
            }
          } catch {}
        }));
      })(),
      ...expandedValidatorIds.map((vid) =>
        serverQueryClient.prefetchQuery({
          queryKey: ['stake-history', network, vid],
          queryFn: () => fetchStakeHistoryCached(vid, network),
          staleTime: 5 * 60_000,
        })
      ),
    ]);
  } catch (error) {
    logger.error({ err: error }, '[DashboardPage] Prefetch failed');
  }

  const marketData = await getMarketDataCached();

  // Calculate final stats for RSC
  const stats: NetworkStats = (() => {
    if (networkStats) return networkStats;
    const active = realValidators.filter(v => v.status === 'active');
    const totalStaked = realValidators.reduce((s, v) => s + v.totalStakeXRD, 0);
    return {
      totalStaked,
      activeValidators: active.length,
      totalValidators: realValidators.length,
      avgApy: active.length > 0 ? active.reduce((s, v) => s + v.apy, 0) / active.length : 0,
      avgUptime: active.length > 0 ? active.reduce((s, v) => s + v.uptimePercent, 0) / active.length : 0,
      epoch: 0,
    };
  })();

  const statsRow = (
    <DashboardStatsRow
      activeView={initialView}
      stats={stats}
      marketData={marketData}
      isLoading={false}
      dt={dt}
      locale={locale}
    />
  );

  return (
    <ReactQueryHydrate state={dehydrate(serverQueryClient)}>
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
        initialExpandedValidators={c.ids(COOKIE_KEYS.expandedValidators, network)}
        initialExpandedTxs={initialExpandedTxs}
        initialSearchQuery={txid ?? ''}
        initialDateRange={initialDateRange}
        randomSeed={randomSeed}
        initialMarketData={marketData}
        statsRow={statsRow}
      />
    </ReactQueryHydrate>
  );
}
