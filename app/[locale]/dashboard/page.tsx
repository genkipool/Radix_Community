import { unstable_cache } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { dehydrate } from '@tanstack/react-query';
import { ReactQueryHydrate } from '@/components/layout/ReactQueryHydrate';
import {
  fetchValidatorsWithLedger, computeNetworkStats,
  fetchRecentTransactions, fetchStakeHistoryCached,
  searchTransactionsByAddress, fetchTransactionDetails, fetchEntityDetails,
  type Validator, type NetworkStats,
} from '@/services/radixApi';
import type { TransactionDetails } from '@/features/dashboard/types';
import type { TransactionInfo } from '@/types/radix';
import DashboardClient from '@/features/dashboard/DashboardClient';
import { entityKeys, extractEntityMeta } from '@/features/dashboard/hooks/useEntityData';
import { makeQueryClient } from '@/lib/queryClient';
import logger from '@/lib/logger';
import { validateTxHash } from '@/utils/apiValidation';
import { COOKIE_KEYS } from '@/constants/dashboard';

import type { Network, SortMode, DashboardView } from '@/features/dashboard/types';
import type { FungibleChange, NonFungibleChange } from '@/features/dashboard/types/shared.types';
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

// ── Dynamic Rendering ──────────────────────────────────────────
// The dashboard relies heavily on user-specific UI cookies (e.g. 
// expanded transactions). It MUST be rendered dynamically per request 
// so the hydration payload accurately matches the user's local state.
// All heavy data fetches are cached globally via `unstable_cache`.
export const dynamic = 'force-dynamic';

// ── Cached data fetchers ───────────────────────────────────────
// unstable_cache deduplicates concurrent requests so only ONE call goes to
// the Radix Gateway API, regardless of how many users hit the page at once.

const getCachedValidators = unstable_cache(
  async (network: Network) => {
    const { validators, ledgerState } = await fetchValidatorsWithLedger(network);
    const networkStats = computeNetworkStats(
      validators,
      ledgerState.epoch,
      ledgerState.state_version,
      ledgerState.round,
      ledgerState.proposer_round_timestamp,
    );
    return { validators, networkStats };
  },
  ['dashboard-validators'],
  { revalidate: 300, tags: ['validators'] },
);

const getCachedTransactions = unstable_cache(
  async (network: Network) => fetchRecentTransactions(undefined, 100, network),
  ['dashboard-transactions'],
  { revalidate: 30, tags: ['transactions'] },
);

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
  const ids = (name: string) => {
    const raw = decoded(name);
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
  searchParams: Promise<{ view?: string; network?: string; tx?: string }>;
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
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const initialView = (params.view === 'transactions' || params.tx) ? 'transactions' : 'staking';
  const network = (params.network === 'stokenet' ? 'stokenet' : 'mainnet') as Network;

  // Read all persisted UI state from cookies
  const cookieStore = await cookies();
  const headerStore = await headers();
  const c = makeCookieReader(cookieStore);

  // Timezone resolution: Cookie > Geo Fallback > UTC
  const clientTz = c.decoded('client-tz');
  const country = headerStore.get('cf-ipcountry') || headerStore.get('x-vercel-ip-country');
  const timezone = clientTz || (country === 'ES' ? 'Europe/Madrid' : 'UTC');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const randomSeed = Math.floor(startOfDay / (1000 * 60 * 60)); // Stable for the entire day

  const emptyNetworkStats: NetworkStats = {
    totalStaked: 0, activeValidators: 0, totalValidators: 0,
    avgApy: 0, avgUptime: 0, epoch: 0,
  };

  // Pre-populate React Query cache server-side
  const serverQueryClient = makeQueryClient();

  // If a validator modal is open (restored from cookie), prefetch its stake
  // history so SSR and first client render have identical data — no hydration
  // mismatch and no spinner flash on reload.
  const openValidatorId = c.ids(COOKIE_KEYS.expandedValidators)[0] ?? null;
  const txid = params.tx ? validateTxHash(params.tx) : null;
  const initialExpandedTxs = txid && txid.startsWith('txid_') ? [txid] : c.ids(COOKIE_KEYS.expandedTxs);

  try {
    await Promise.all([
      serverQueryClient.prefetchQuery({
        queryKey: ['validators', network],
        queryFn: async () => {
          const data = await getCachedValidators(network);
          return {
            validators: data?.validators ?? [] as Validator[],
            networkStats: data?.networkStats ?? emptyNetworkStats,
          };
        },
        staleTime: 60_000,
      }),
      serverQueryClient.prefetchInfiniteQuery({
        // Key must exactly match useTransactionsQuery's queryKey:
        // ['transactions', network, serverSideAddr, tag, dateRange]
        // Default state: no address filter, tag='All', no date range.
        queryKey: ['transactions', network, txid ?? undefined, 'All', { start: null, end: null }],
        queryFn: async () => {
          if (txid) {
            const data = await searchTransactionsByAddress(txid, undefined, 15, network);
            return {
              transactions: data.transactions,
              nextCursor: data.nextCursor,
            };
          }
          const data = await getCachedTransactions(network);
          return {
            transactions: (data?.transactions ?? []) as TransactionInfo[],
            nextCursor: data?.nextCursor ?? undefined,
          };
        },
        initialPageParam: undefined,
        staleTime: 10_000,
      }),
      ...(openValidatorId ? [
        serverQueryClient.prefetchQuery({
          queryKey: ['stake-history', network, openValidatorId],
          queryFn: () => fetchStakeHistoryCached(openValidatorId, network),
          staleTime: 5 * 60_000,
        }),
      ] : []),
      // DEEP PREFETCHING: Prefetch transaction details AND all associated entity metadata 
      // for any expanded cards to avoid the "metadata flash" on reload.
      ...initialExpandedTxs.map(async (txHash: string) => {
        const rawDetails = await fetchTransactionDetails(txHash, network);
        if (!rawDetails) return;

        // 1. Inject transaction details into cache
        serverQueryClient.setQueryData(['tx-details', txHash, network], rawDetails);

        // 2. Extract unique resource/entity addresses from the transaction
        const addressesToFetch = new Set<string>();
        const item = rawDetails as TransactionDetails;
        
        // Add globally affected entities (usually components, accounts, and validators)
        const entities = item.affected_global_entities || [];
        (entities as Array<string | { address: string }>).forEach((e) => {
          const addr = typeof e === 'string' ? e : e?.address;
          if (addr && (addr.startsWith('resource_') || addr.startsWith('component_') || addr.startsWith('validator_'))) {
            addressesToFetch.add(addr);
          }
        });

        // Add resource addresses strictly from balance changes (simple transfers don't appear in affected_global_entities)
        const bc = item.balance_changes || {};
        (bc.fungible_fee_balance_changes || []).forEach((fc) => {
            const addr = fc.resource_address || (network === 'stokenet' ? 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc' : 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd');
            addressesToFetch.add(addr);
        });
        (bc.fungible_balance_changes || []).forEach((fc: FungibleChange) => {
            if (fc.resource_address) addressesToFetch.add(fc.resource_address);
        });
        (bc.non_fungible_balance_changes || []).forEach((nfc: NonFungibleChange) => {
            if (nfc.resource_address) addressesToFetch.add(nfc.resource_address);
        });

        // 3. Fetch all entity metadata in parallel and inject to cache
        await Promise.all(
          Array.from(addressesToFetch).map(async (addr) => {
            const entDetails = await fetchEntityDetails(addr, network);
            if (entDetails) {
              serverQueryClient.setQueryData(entityKeys.full(addr, network), entDetails);
              serverQueryClient.setQueryData(entityKeys.detail(addr, network), extractEntityMeta(entDetails));
            }
          })
        );
      }),

    ]);
  } catch (error) {
    // Non-fatal: the client fetches on mount if cache is empty
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ err: error }, '[DashboardPage] Failed to prefetch data: %s', message);
  }

  return (
    <ReactQueryHydrate state={dehydrate(serverQueryClient)}>
      <DashboardClient
        timezone={timezone}
        initialView={initialView as DashboardView}
        initialNetwork={network}
        initialActiveTag={c.ids(COOKIE_KEYS.activeTag).length > 0 ? c.ids(COOKIE_KEYS.activeTag) : ['All']}
        initialTransactionActiveTag={c.decoded(COOKIE_KEYS.txTag) ?? 'All'}
        initialValSortMode={c.sort(COOKIE_KEYS.valSortMode)}
        initialTxSortMode={c.sort(COOKIE_KEYS.txSortMode)}
        initialValColumns={c.int(COOKIE_KEYS.valColumns, 2)}
        initialTxColumns={c.int(COOKIE_KEYS.txColumns, 1)}
        initialValReadingMode={c.bool(COOKIE_KEYS.valReadingMode)}
        initialTxReadingMode={c.bool(COOKIE_KEYS.txReadingMode)}
        initialValAutoCollapse={c.bool(COOKIE_KEYS.valAutoCollapse)}
        initialTxAutoCollapse={c.bool(COOKIE_KEYS.txAutoCollapse)}
        initialExpandedValidators={c.ids(COOKIE_KEYS.expandedValidators)}
        initialExpandedTxs={txid && txid.startsWith('txid_') ? [txid] : c.ids(COOKIE_KEYS.expandedTxs)}
        initialSearchQuery={txid ?? ''}
        randomSeed={randomSeed}
      />
    </ReactQueryHydrate>
  );
}
