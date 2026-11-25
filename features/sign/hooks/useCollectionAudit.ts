'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCollectionAudit } from '../services/signApi';
import type {
  AuditRecord,
  AuditSignerSummary,
  CollectionAuditResponse,
} from '../lib/collection-audit';

function mergeSignerSummaries(
  existing: AuditSignerSummary[],
  incoming: AuditSignerSummary[],
): AuditSignerSummary[] {
  const map = new Map<string, AuditSignerSummary>();
  for (const s of existing) map.set(s.account, { ...s });
  for (const s of incoming) {
    const prev = map.get(s.account);
    if (!prev) {
      map.set(s.account, { ...s });
      continue;
    }
    const first =
      !prev.firstActivityAt
        ? s.firstActivityAt
        : !s.firstActivityAt
          ? prev.firstActivityAt
          : Date.parse(prev.firstActivityAt) <= Date.parse(s.firstActivityAt)
            ? prev.firstActivityAt
            : s.firstActivityAt;
    const last =
      !prev.lastActivityAt
        ? s.lastActivityAt
        : !s.lastActivityAt
          ? prev.lastActivityAt
          : Date.parse(prev.lastActivityAt) >= Date.parse(s.lastActivityAt)
            ? prev.lastActivityAt
            : s.lastActivityAt;
    map.set(s.account, {
      account: s.account,
      hasVerifiedSeal: prev.hasVerifiedSeal || s.hasVerifiedSeal,
      hasOwnCollection: prev.hasOwnCollection || s.hasOwnCollection,
      invitedCount: prev.invitedCount + s.invitedCount,
      signedCount: prev.signedCount + s.signedCount,
      pendingCount: prev.pendingCount + s.pendingCount,
      cipherCount: prev.cipherCount + s.cipherCount,
      firstActivityAt: first,
      lastActivityAt: last,
    });
  }
  return [...map.values()].sort((a, b) => {
    const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const tb = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return tb - ta || b.signedCount - a.signedCount || a.account.localeCompare(b.account);
  });
}

function mergeRecords(
  primary: AuditRecord[],
  older: AuditRecord[],
): AuditRecord[] {
  const seen = new Set(primary.map((r) => r.id));
  const combined = [...primary];
  for (const r of older) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      combined.push(r);
    }
  }
  return combined.sort(
    (a, b) =>
      b.stateVersion - a.stateVersion || b.firstNumericId - a.firstNumericId,
  );
}

/**
 * Loads the live on-ledger audit snapshot for a signing collection and
 * supports progressive loading of older history pages without losing current
 * filters or re-fetching the newest window unnecessarily.
 */
export function useCollectionAudit(
  networkId: number | null,
  collection: string | null,
) {
  const [olderPages, setOlderPages] = useState<{
    key: string;
    records: AuditRecord[];
    signers: AuditSignerSummary[];
    scannedFromId: number;
    hasMoreOlder: boolean;
  } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);

  const activeKey =
    networkId != null && collection ? `${networkId}:${collection}` : '';

  const query = useQuery({
    queryKey: ['collection-audit', networkId, collection],
    enabled: !!activeKey,
    staleTime: 30_000,
    retry: false,
    queryFn: () =>
      fetchCollectionAudit({
        networkId: networkId!,
        collection: collection!,
      }),
  });

  const base = query.data ?? null;
  const activeOlder =
    olderPages && olderPages.key === activeKey ? olderPages : null;

  const merged: CollectionAuditResponse | null =
    base && base.found
      ? {
          ...base,
          scannedFromId: activeOlder
            ? Math.min(base.scannedFromId, activeOlder.scannedFromId)
            : base.scannedFromId,
          hasMoreOlder: activeOlder
            ? activeOlder.hasMoreOlder
            : base.hasMoreOlder,
          records: activeOlder
            ? mergeRecords(base.records, activeOlder.records)
            : base.records,
          signers: activeOlder
            ? mergeSignerSummaries(base.signers, activeOlder.signers)
            : base.signers,
        }
      : base;

  const loadOlder = async () => {
    if (!merged || !merged.hasMoreOlder || loadingOlder || networkId == null || !collection) {
      return;
    }
    const nextToId = merged.scannedFromId - 1;
    if (nextToId < 1) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await fetchCollectionAudit({
        networkId,
        collection,
        toId: nextToId,
      });
      if (!page.found) return;
      setOlderPages((prev) => {
        const prevForKey = prev && prev.key === activeKey ? prev : null;
        return {
          key: activeKey,
          records: prevForKey
            ? mergeRecords(prevForKey.records, page.records)
            : page.records,
          signers: prevForKey
            ? mergeSignerSummaries(prevForKey.signers, page.signers)
            : page.signers,
          scannedFromId: page.scannedFromId,
          hasMoreOlder: page.hasMoreOlder,
        };
      });
    } catch (err) {
      setOlderError(err instanceof Error ? err.message : 'audit_older_failed');
    } finally {
      setLoadingOlder(false);
    }
  };

  const refresh = async () => {
    setOlderPages(null);
    setOlderError(null);
    await query.refetch();
  };

  return {
    audit: merged,
    loading: query.isLoading,
    fetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : olderError,
    loadingOlder,
    loadOlder,
    refresh,
  };
}
