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
  const [state, setState] = useState<PreviewState>(INITIAL);

  const simulate = async (manifest: string) => {
    setState({ isSimulating: true, preview: null, error: null });
    try {
      const preview = await previewTransaction(manifest, activeNetwork);
      setState({ isSimulating: false, preview, error: null });
    } catch (err) {
      setState({
        isSimulating: false,
        preview: null,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  };

  const reset = () => setState(INITIAL);

  return { ...state, simulate, reset };
}
