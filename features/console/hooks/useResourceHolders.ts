'use client';

import { useRef, useState } from 'react';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { fetchAllHolders, type Holder } from '../lib/resource-holders';

/**
 * Every holder of a resource, read page by page from the Gateway on demand,
 * with progress. A newer load supersedes an older one still in flight.
 */
export function useResourceHolders() {
  const { activeNetwork } = useRadixWallet();
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const load = async (resource: string) => {
    const target = resource.trim();
    if (!target.startsWith('resource_')) return;
    const seq = ++loadSeq.current;
    setError(null);
    setHolders(null);
    setProgress({ loaded: 0, total: null });
    try {
      const result = await fetchAllHolders(
        (path, body) => gatewayPost(activeNetwork, path, body),
        target,
        { onPage: (loaded, all) => seq === loadSeq.current && setProgress({ loaded, total: all }) },
      );
      if (seq !== loadSeq.current) return;
      setHolders(result.holders);
      setTotal(result.total);
      setTruncated(result.truncated);
    } catch (err) {
      if (seq === loadSeq.current) setError(err instanceof Error ? err.message : String(err));
    }
    if (seq === loadSeq.current) setProgress(null);
  };

  return { holders, total, truncated, progress, error, load };
}
