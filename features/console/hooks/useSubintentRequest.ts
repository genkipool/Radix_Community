'use client';

import { useState } from 'react';
import { SubintentRequestBuilder } from '@radixdlt/radix-dapp-toolkit';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { sendToWallet } from '@/features/wallet/lib/wallet-requests';

export interface SubintentResult {
  subintentHash: string;
  signedPartialTransaction: string;
  expirationTimestamp: number;
}

interface SubintentState {
  isSending: boolean;
  result: SubintentResult | null;
  error: string | null;
}

const INITIAL: SubintentState = { isSending: false, result: null, error: null };

/**
 * Sends a subintent manifest to the wallet as a pre-authorization request.
 * The wallet signs it and returns a signed partial transaction that another
 * party can embed into a full transaction before it expires.
 */
export function useSubintentRequest() {
  const { activeNetworkId } = useRadixWallet();
  const [state, setState] = useState<SubintentState>(INITIAL);

  const reset = () => setState(INITIAL);

  const sendSubintent = async (manifest: string, expireAfterSeconds: number) => {
    if (!activeNetworkId) {
      setState({ ...INITIAL, error: 'wallet_not_connected' });
      return;
    }
    const rdt = getOrCreateToolkit(activeNetworkId);
    if (!rdt) {
      setState({ ...INITIAL, error: 'toolkit_not_initialized' });
      return;
    }

    setState({ isSending: true, result: null, error: null });
    const response = await sendToWallet(rdt, 'preAuthorization', () =>
      rdt.walletApi.sendPreAuthorizationRequest(
        SubintentRequestBuilder()
          .manifest(manifest)
          .setExpiration('afterDelay', expireAfterSeconds)
          .addBlobs(),
      ),
    );

    if (!response.ok) {
      const { reason, code } = response.failure;
      setState({ ...INITIAL, error: reason === 'cancelled' ? null : code });
      return;
    }
    setState({ isSending: false, result: response.value, error: null });
  };

  return { ...state, sendSubintent, reset };
}
