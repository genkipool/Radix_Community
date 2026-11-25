'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import {
  extractPublicDomain,
  type DomainVerificationResult,
} from '../lib/domain-verify';
import { fetchDomainVerification } from '../services/signApi';

const DOMAIN_VERIFY_STALE_MS = 60_000;

export function domainVerificationQueryKey(
  domain: string | null,
  collection: string | null,
  account?: string | null,
) {
  return ['domain-verify', domain ?? '', collection ?? '', account ?? ''] as const;
}

/**
 * Live custody-free domain verification for a single signing collection
 * (`/.well-known/radix-seal.json` or DNS TXT `_radix-seal.<domain>`).
 * Works identically on Mainnet (`resource_rdx1…`) and Stokenet (`resource_tdx_2_1…`).
 */
export function useDomainVerification({
  orgUrl,
  collection,
  account,
  initialData,
}: {
  orgUrl: string | null | undefined;
  collection: string | null | undefined;
  account?: string | null;
  /** Optional server-computed snapshot (e.g. from Audit) to avoid an extra fetch on mount. */
  initialData?: DomainVerificationResult | null;
}) {
  const domain = extractPublicDomain(orgUrl);
  const col = collection ?? null;
  const matchingInitial =
    initialData && domain && initialData.domain === domain
      ? initialData
      : undefined;
  const initialUpdatedAt = matchingInitial
    ? Date.parse(matchingInitial.checkedAt) || undefined
    : undefined;

  const query = useQuery({
    queryKey: domainVerificationQueryKey(domain, col, account),
    enabled: !!domain && !!col,
    staleTime: DOMAIN_VERIFY_STALE_MS,
    retry: false,
    initialData: matchingInitial,
    initialDataUpdatedAt: initialUpdatedAt,
    queryFn: () =>
      fetchDomainVerification({
        orgUrl: `https://${domain!}`,
        collection: col!,
        account: account ?? undefined,
      }),
  });

  return {
    domain,
    result: (query.data ?? null) as DomainVerificationResult | null,
    checking: !!domain && query.isFetching,
    error: query.isError,
    refetch: query.refetch,
  };
}

export interface CollectionDomainStatus {
  domain: string | null;
  result: DomainVerificationResult | null;
  checking: boolean;
}

/**
 * Batch live domain verification for a list of signing collections, sharing
 * the exact same React Query cache keys as {@link useDomainVerification}.
 */
export function useCollectionsDomainVerification(
  collections: ReadonlyArray<{ resourceAddress: string; orgUrl?: string }>,
  account?: string | null,
): Map<string, CollectionDomainStatus> {
  const domains = collections.map((c) => extractPublicDomain(c.orgUrl));

  const results = useQueries({
    queries: collections.map((col, idx) => {
      const domain = domains[idx];
      return {
        queryKey: domainVerificationQueryKey(
          domain,
          col.resourceAddress,
          account,
        ),
        enabled: !!domain && !!col.resourceAddress,
        staleTime: DOMAIN_VERIFY_STALE_MS,
        retry: false,
        queryFn: () =>
          fetchDomainVerification({
            orgUrl: `https://${domain!}`,
            collection: col.resourceAddress,
            account: account ?? undefined,
          }),
      };
    }),
  });

  const statusByAddress = new Map<string, CollectionDomainStatus>();
  collections.forEach((col, idx) => {
    const domain = domains[idx];
    const q = results[idx];
    statusByAddress.set(col.resourceAddress, {
      domain,
      result: (q?.data ?? null) as DomainVerificationResult | null,
      checking: !!domain && !!q?.isFetching,
    });
  });

  return statusByAddress;
}
