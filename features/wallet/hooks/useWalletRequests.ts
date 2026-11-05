'use client';

import { useSyncExternalStore } from 'react';
import {
  pendingWalletRequests,
  subscribeWalletRequests,
  type PendingWalletRequest,
} from '../lib/wallet-requests';

const NONE: readonly PendingWalletRequest[] = [];

/**
 * The requests waiting for the wallet, and whether the wallet already has
 * one: cancelling then still drops it from the extension, but on the phone
 * the person has to reject it, which the cancel buttons say in their title.
 */
export function useWalletRequests() {
  const pending = useSyncExternalStore(subscribeWalletRequests, pendingWalletRequests, () => NONE);
  return { pending, inWallet: pending.some((request) => request.inWallet) };
}
