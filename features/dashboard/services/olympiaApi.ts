/**
 * Client access to `/api/olympia/*`, with the React Query keys and hooks the
 * explorer uses. Olympia's data is final, so every query is kept for the whole
 * session (`staleTime: Infinity`) and "not on Olympia" (404) is an answer, not
 * an error.
 */
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FundsFlow } from '@/features/dashboard/explorador/utils/fundsFlow';
import type {
  OlympiaAccountSummary,
  OlympiaDailyReward,
  OlympiaLink,
  OlympiaResource,
  OlympiaTxDetail,
  OlympiaTxPage,
  OlympiaValidator,
  OlympiaValidatorDay,
} from '@/types/olympia';

export type OlympiaTxDatePage = { items: OlympiaTxDetail[]; nextCursor?: string };

export type OlympiaFundsResponse = FundsFlow & { more: boolean; olympiaAddress: string };

/** GET a route; null when the thing is not on Olympia (404). */
async function getOrNull<T>(path: string, params: Record<string, string | number | undefined>): Promise<T | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  const res = await fetch(`/api/olympia/${path}?${qs.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`olympia ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const olympiaApi = {
  link: (babylonAddress: string) => getOrNull<OlympiaLink>('account/link', { address: babylonAddress }),
  account: (address: string) => getOrNull<OlympiaAccountSummary>('account', { address }),
  transactions: (address: string, before?: string, limit = 15) =>
    getOrNull<OlympiaTxPage>('account/transactions', { address, before, limit }),
  funds: (address: string) => getOrNull<OlympiaFundsResponse>('account/funds', { address }),
  accountRewards: (address: string, year: number) =>
    getOrNull<{ olympiaAddress: string; year: number; days: OlympiaDailyReward[] }>('account/rewards', { address, year }),
  tx: (id: string) => getOrNull<OlympiaTxDetail>('tx', { id }),
  byDate: (from: number, to: number, before?: string, limit = 15) =>
    getOrNull<OlympiaTxDatePage>('transactions', { from, to, before, limit }),
  resource: (rri: string) => getOrNull<OlympiaResource>('resource', { rri }),
  validator: (address: string) => getOrNull<OlympiaValidator>('validator', { address }),
  validatorDelegators: (address: string, offset: number, limit = 50) =>
    getOrNull<{ items: { address: string; stakedXrd: number }[]; total: number }>('validator/delegators', { address, offset, limit }),
  validatorByKey: (key: string) => getOrNull<{ address: string; name: string | null }>('validator/by-key', { key }),
  validatorRewards: (address: string, year: number) =>
    getOrNull<{ address: string; year: number; days: OlympiaValidatorDay[] }>('validator/rewards', { address, year }),
};

export const olympiaKeys = {
  all: ['olympia'] as const,
  link: (a: string) => ['olympia', 'link', a] as const,
  account: (a: string) => ['olympia', 'account', a] as const,
  transactions: (a: string) => ['olympia', 'transactions', a] as const,
  funds: (a: string) => ['olympia', 'funds', a] as const,
  tx: (id: string) => ['olympia', 'tx', id.toLowerCase()] as const,
  byDate: (from: number, to: number) => ['olympia', 'by-date', from, to] as const,
  resource: (rri: string) => ['olympia', 'resource', rri] as const,
  validator: (a: string) => ['olympia', 'validator', a] as const,
};

const FINAL = { staleTime: Infinity, gcTime: 30 * 60_000, retry: 1 } as const;

/** The Olympia address a Babylon account came from (null: it did not exist on Olympia). Mainnet only. */
export function useOlympiaLink(babylonAddress: string, network: string) {
  return useQuery({
    queryKey: olympiaKeys.link(babylonAddress),
    queryFn: () => olympiaApi.link(babylonAddress),
    enabled: network === 'mainnet' && babylonAddress.startsWith('account_rdx1'),
    ...FINAL,
  });
}

export function useOlympiaAccount(address: string | null | undefined) {
  return useQuery({
    queryKey: olympiaKeys.account(address ?? ''),
    queryFn: () => olympiaApi.account(address!),
    enabled: !!address,
    ...FINAL,
  });
}

export function useOlympiaTransactions(address: string | null | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: olympiaKeys.transactions(address ?? ''),
    queryFn: ({ pageParam }) => olympiaApi.transactions(address!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last?.nextCursor,
    enabled: !!address && enabled,
    ...FINAL,
  });
}

export function useOlympiaFunds(address: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: olympiaKeys.funds(address ?? ''),
    queryFn: () => olympiaApi.funds(address!),
    enabled: !!address && enabled,
    ...FINAL,
  });
}

export function useOlympiaTx(id: string | null | undefined) {
  return useQuery({ queryKey: olympiaKeys.tx(id ?? ''), queryFn: () => olympiaApi.tx(id!), enabled: !!id, ...FINAL });
}

export function useOlympiaResource(rri: string | null | undefined) {
  return useQuery({ queryKey: olympiaKeys.resource(rri ?? ''), queryFn: () => olympiaApi.resource(rri!), enabled: !!rri, ...FINAL });
}

export function useOlympiaValidator(address: string | null | undefined) {
  return useQuery({ queryKey: olympiaKeys.validator(address ?? ''), queryFn: () => olympiaApi.validator(address!), enabled: !!address, ...FINAL });
}

/**
 * Every Olympia transaction between two instants (ms), newest first, a page at
 * a time. Each transaction comes in full, so it is also stored under its own
 * key and its card opens without another read.
 */
export function useOlympiaTxsByDate(range: { from: number; to: number } | null) {
  const client = useQueryClient();
  return useInfiniteQuery({
    queryKey: olympiaKeys.byDate(range?.from ?? 0, range?.to ?? 0),
    queryFn: async ({ pageParam }) => {
      const page = await olympiaApi.byDate(range!.from, range!.to, pageParam);
      for (const tx of page?.items ?? []) client.setQueryData(olympiaKeys.tx(tx.transactionId), tx);
      return page;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last?.nextCursor,
    enabled: !!range,
    ...FINAL,
  });
}

/** The Olympia validator that ran with this node key (null: none did). */
export function useOlympiaValidatorByKey(publicKey: string | null | undefined) {
  return useQuery({
    queryKey: ['olympia', 'validator-by-key', (publicKey ?? '').toLowerCase()],
    queryFn: () => olympiaApi.validatorByKey(publicKey!),
    enabled: !!publicKey && /^0[23][0-9a-fA-F]{64}$/.test(publicKey),
    ...FINAL,
  });
}
