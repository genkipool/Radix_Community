'use client';

import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { apiFetchTransactionDetails } from '@/features/dashboard/services/apiClient';
import type { ConsoleTxResult } from '../types/console.types';

const TX_TIMEOUT_MS = 300_000;

interface SendOptions {
  /** Hex-encoded blobs referenced by the manifest (e.g. package WASM) */
  blobs?: string[];
}

interface TxState {
  isSending: boolean;
  result: ConsoleTxResult | null;
  error: string | null;
}

const INITIAL_STATE: TxState = { isSending: false, result: null, error: null };

function extractCreatedEntities(details: Record<string, unknown>): string[] {
  const receipt = details.receipt as
    | { state_updates?: { new_global_entities?: Array<{ entity_address?: string }> } }
    | undefined;
  return (receipt?.state_updates?.new_global_entities ?? [])
    .flatMap((e) => (e.entity_address ? [e.entity_address] : []));
}

/**
 * Sends a raw transaction manifest to the connected Radix Wallet and resolves
 * the committed result, including any entities the transaction created.
 */
export function useConsoleTransaction() {
  const { activeNetworkId, activeNetwork } = useRadixWallet();
  const [state, setState] = useState<TxState>(INITIAL_STATE);

  const reset = () => setState(INITIAL_STATE);

  const sendTransaction = async (
    transactionManifest: string,
    { blobs }: SendOptions = {},
  ): Promise<ConsoleTxResult | null> => {
    if (!activeNetworkId) {
      setState({ ...INITIAL_STATE, error: 'wallet_not_connected' });
      return null;
    }
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) {
      setState({ ...INITIAL_STATE, error: 'toolkit_not_initialized' });
      return null;
    }

    setState({ isSending: true, result: null, error: null });

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TX_TIMEOUT_MS),
      );
      const response = await Promise.race([
        rdt.walletApi.sendTransaction({ transactionManifest, blobs, version: 1 }),
        timeout,
      ]);

      if (response.isErr()) {
        const err = response.error as { error?: string; message?: string };
        setState({ isSending: false, result: null, error: err.error || err.message || 'rejected' });
        return null;
      }

      const { transactionIntentHash, status } = response.value;

      let createdEntities: string[] = [];
      try {
        const details = await apiFetchTransactionDetails(transactionIntentHash, activeNetwork);
        createdEntities = extractCreatedEntities(details);
      } catch {
        // Created entities are informational only — the tx itself succeeded.
      }

      const result: ConsoleTxResult = { transactionIntentHash, status, createdEntities };
      setState({ isSending: false, result, error: null });
      return result;
    } catch (err) {
      setState({
        isSending: false,
        result: null,
        error: err instanceof Error ? err.message : 'unknown',
      });
      return null;
    }
  };

  return { ...state, sendTransaction, reset };
}
