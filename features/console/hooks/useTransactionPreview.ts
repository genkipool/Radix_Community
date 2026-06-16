'use client';

import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { previewTransaction, type TransactionPreviewResult } from '../services/transactionPreview';

interface PreviewState {
  isSimulating: boolean;
  preview: TransactionPreviewResult | null;
  error: string | null;
}

const INITIAL: PreviewState = { isSimulating: false, preview: null, error: null };

/** Dry-runs a manifest against the Gateway preview endpoint (no signatures). */
export function useTransactionPreview() {
  const { activeNetwork } = useRadixWallet();
  const networkName = activeNetwork;
  const [states, setStates] = useState<Record<string, PreviewState>>({});

  const state = states[networkName] || INITIAL;

  const simulate = async (manifest: string) => {
    setStates(prev => ({ ...prev, [networkName]: { isSimulating: true, preview: null, error: null } }));
    try {
      const preview = await previewTransaction(manifest, activeNetwork);
      setStates(prev => ({ ...prev, [networkName]: { isSimulating: false, preview, error: null } }));
    } catch (err) {
      setStates(prev => ({
        ...prev,
        [networkName]: {
          isSimulating: false,
          preview: null,
          error: err instanceof Error ? err.message : 'unknown',
        }
      }));
    }
  };

  const reset = () => setStates(prev => ({ ...prev, [networkName]: INITIAL }));

  return { ...state, simulate, reset };
}
