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
 * one: a cancel button here is disabled then, as only the wallet can reject
 * it from that point.
 */
export function useWalletRequests() {
  const pending = useSyncExternalStore(subscribeWalletRequests, pendingWalletRequests, () => NONE);
  return { pending, inWallet: pending.some((request) => request.inWallet) };
}
