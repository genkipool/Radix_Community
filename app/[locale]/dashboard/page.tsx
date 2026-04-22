import { cookies, headers } from 'next/headers';
import { dehydrate } from '@tanstack/react-query';
import { ReactQueryHydrate } from '@/components/layout/ReactQueryHydrate';
import {
  getValidatorsCached,
  getRecentTransactionsCached,
  fetchStakeHistoryCached,
  fetchFilteredTransactions,
  searchTransactionsByAddress, fetchTransactionDetails, fetchEntityDetails,
  type Validator, type NetworkStats,
} from '@/services/radixApi';
import type { TransactionDetails } from '@/features/dashboard/types';
import type { TransactionInfo } from '@/types/radix';
import DashboardClient from '@/features/dashboard/DashboardClient';
import { entityKeys, extractEntityMeta, normalizeAddress, needsFetch } from '@/features/dashboard/utils/entityCache';
import { getNetworkCookieKey } from '@/features/dashboard/utils/cookieUtils';
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

  // Parse date range from URL params
  const start = params.start || null;
  const end = params.end || null;
  const initialDateRange = { start, end };


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
  const urlTag = params.tag ? decodeURIComponent(params.tag) : null;
  const cookieTag = c.decoded(COOKIE_KEYS.txTag) ?? 'All';
  const activeTxTag = urlTag && VALID_TX_TAGS.includes(urlTag) ? urlTag : cookieTag;

  // If a validator modal is open (restored from cookie), prefetch its stake
  // history so SSR and first client render have identical data — no hydration
  // mismatch and no spinner flash on reload.
  const txid = params.tx ? validateTxHash(params.tx) : null;
  const initialExpandedTxs = txid && txid.startsWith('txid_') ? [txid] : c.ids(COOKIE_KEYS.expandedTxs, network);
  const expandedValidatorIds = c.ids(COOKIE_KEYS.expandedValidators, network);

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
    // Validators prefetch is async; transactions are set synchronously.
    // Using a dedicated await ensures validators are in the cache before
    // we enrich proposer info and dehydrate.
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

    // Seed the infinite query cache with the transaction data we just fetched
    serverQueryClient.setQueryData(txQueryKey, {
      pages: [txData],
      pageParams: [undefined],
    });

    // ── PROPOSER ENRICHMENT ─────────────────────────────────────────────
    // Embed validator name/iconUrl/address directly into tx.proposerInfo
    // so TransactionCard renders proposer info without a separate query.
    // Source: validators already fetched into the query cache above.
    const validatorsData = serverQueryClient.getQueryData<{ validators: Validator[] }>(['validators', network]);
    
    if (validatorsData?.validators?.length) {
      let enrichedCount = 0;
      
      // Build a fast lookup map in memory
      const proposerMap: Record<string, { name: string; iconUrl: string; address: string }> = {};
      for (const v of validatorsData.validators) {
        if (v.rank > 0) {
          proposerMap[String(v.rank)] = { name: v.name, iconUrl: v.iconUrl || '', address: v.address };
        }
      }

      txData.transactions.forEach((tx: TransactionInfo) => {
        if (tx.proposerInfo && !tx.proposerInfo.name) {
          const entry = proposerMap[String(tx.proposerInfo.rank)];
          if (entry) {
            tx.proposerInfo.name = entry.name;
            tx.proposerInfo.iconUrl = entry.iconUrl;
            tx.proposerInfo.address = entry.address;
            enrichedCount++;
          }
        }
      });
      
      if (enrichedCount > 0) {
        // Re-set the enriched data in the query cache
        serverQueryClient.setQueryData(txQueryKey, {
          pages: [txData],
          pageParams: [undefined],
        });
        logger.info({ network, enrichedCount }, '[DashboardPage] Proposer info enriched in transaction data');
      }
    }

    // ── PHASE 2: Best-effort hydration (failures don't affect critical data) ──
    await Promise.allSettled([
      // Deep entity metadata hydration for collapsed card symbols
      (async () => {
        const discoveredAddresses = new Set<string>();
        txData.transactions.forEach((tx: TransactionInfo) => {
          if (tx.displayResource && tx.displayResource !== 'XRD') {
            discoveredAddresses.add(tx.displayResource);
          }
          if (tx.validatorAddress) discoveredAddresses.add(tx.validatorAddress);
        });

        const toFetch = Array.from(discoveredAddresses).filter(addr => {
          const clean = normalizeAddress(addr);
          return needsFetch(clean);
        });

        if (toFetch.length > 0) {
          await Promise.all(
            toFetch.map(async (addr) => {
              try {
                const entDetails = await fetchEntityDetails(addr, network);
                if (entDetails) {
                  const normalized = normalizeAddress(addr);
                  serverQueryClient.setQueryData(entityKeys.detail(normalized, network), extractEntityMeta(entDetails));
                }
              } catch (e) {
                logger.debug({ addr, err: e }, '[DashboardPage] Background hydration fetch failed');
              }
            })
          );
        }
      })(),

      // Prefetch stake history for ALL expanded validators
      ...expandedValidatorIds.map((vid) =>
        serverQueryClient.prefetchQuery({
          queryKey: ['stake-history', network, vid],
          queryFn: () => fetchStakeHistoryCached(vid, network),
          staleTime: 5 * 60_000,
        })
      ),

      // Deep prefetching for expanded transactions (restored from cookies)
      ...initialExpandedTxs.map(async (txHash: string) => {
        try {
          const rawDetails = await fetchTransactionDetails(txHash, network);
          if (!rawDetails) return;

          serverQueryClient.setQueryData(['tx-details', txHash, network], rawDetails);

          const addressesToFetch = new Set<string>();
          const item = rawDetails as TransactionDetails;

          const entities = item.affected_global_entities || [];
          (entities as Array<string | { address: string }>).forEach((e) => {
            const addr = typeof e === 'string' ? e : e?.address;
            if (addr && (addr.startsWith('resource_') || addr.startsWith('component_') || addr.startsWith('validator_'))) {
              addressesToFetch.add(addr);
            }
          });

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

          await Promise.all(
            Array.from(addressesToFetch).map(async (addr) => {
              try {
                const entDetails = await fetchEntityDetails(addr, network);
                if (entDetails) {
                  const clean = normalizeAddress(addr);
                  serverQueryClient.setQueryData(entityKeys.full(clean, network), entDetails);
                  serverQueryClient.setQueryData(entityKeys.detail(clean, network), extractEntityMeta(entDetails));
                }
              } catch (e) {
                logger.debug({ addr, err: e }, '[DashboardPage] Expanded tx entity fetch failed');
              }
            })
          );
        } catch (e) {
          logger.debug({ txHash, err: e }, '[DashboardPage] Expanded tx prefetch failed');
        }
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
        initialExpandedTxs={txid && txid.startsWith('txid_') ? [txid] : c.ids(COOKIE_KEYS.expandedTxs, network)}
        initialSearchQuery={txid ?? ''}
        initialDateRange={initialDateRange}
        randomSeed={randomSeed}
      />

    </ReactQueryHydrate>
  );
}
