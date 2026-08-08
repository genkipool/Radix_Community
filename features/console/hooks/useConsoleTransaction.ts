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

/**
 * Statuses that mean the ledger accepted AND executed the transaction. The
 * Gateway has answered `Committed` as well as `CommittedSuccess` over the
 * years, and the rest of this app treats both as success (see the staking and
 * builder flows), so this does too.
 */
const SUCCESS_STATUSES = new Set(['CommittedSuccess', 'Committed']);

function extractCreatedEntities(details: Record<string, unknown>): string[] {
  const receipt = details.receipt as
    | { state_updates?: { new_global_entities?: Array<{ entity_address?: string }> } }
    | undefined;
  return (receipt?.state_updates?.new_global_entities ?? [])
    .flatMap((e) => (e.entity_address ? [e.entity_address] : []));
}

/**
 * What the LEDGER says happened, read back from the committed-details response
 * (`CommittedSuccess`, `CommittedFailure`, `Rejected`…). Empty when the Gateway
 * does not say, in which case the wallet's own status stands.
 */
function ledgerStatus(details: Record<string, unknown>): string {
  const status = details.transaction_status;
  return typeof status === 'string' ? status : '';
}

/**
 * Sends a raw transaction manifest to the connected Radix Wallet and resolves
 * the committed result, including any entities the transaction created.
 *
 * A result is returned ONLY for a transaction the ledger committed
 * successfully; anything else (rejected, committed failure, still pending)
 * resolves to null with the status as the error code. Callers can therefore
 * treat a non-null result as proof the work happened on-ledger.
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
      /*
       * The wallet's own status is not the last word. It reports what the
       * connector saw, and a transaction can come back `Pending` or `Unknown`
       * from a poll that gave up — so callers that took a non-null result as
       * "signed" went on to build certificates and PDFs for a transaction the
       * ledger never committed. The committed details settle it.
       */
      let committedStatus = status as string;
      try {
        const details = await apiFetchTransactionDetails(transactionIntentHash, activeNetwork);
        createdEntities = extractCreatedEntities(details);
        committedStatus = ledgerStatus(details) || committedStatus;
      } catch {
        // The Gateway could not be read: fall back to the wallet's status,
        // which is still checked below.
      }

      if (!SUCCESS_STATUSES.has(committedStatus)) {
        setState({ isSending: false, result: null, error: committedStatus || 'not_committed' });
        return null;
      }

      const result: ConsoleTxResult = {
        transactionIntentHash,
        status: committedStatus,
        createdEntities,
      };
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
