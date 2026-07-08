'use client';

import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import {
  buildSigningRequestManifest,
  buildSignatureManifest,
} from '../lib/manifest';
import type { DisclosurePolicy } from '../types/sign.types';

export type RequestPhase = 'idle' | 'creating' | 'signing' | 'done' | 'error';

/**
 * On-ledger "by reference" signing: the initiator mints a request NFT (its
 * global id is the shareable key), and each signer mints their own signature
 * NFT pointing back at it. No coordinator, no shared fee account — each signer
 * pays for their own signature.
 */
export function useSigningRequest() {
  const { activeNetworkId } = useRadixWallet();
  const { sendTransaction } = useConsoleTransaction();
  const [phase, setPhase] = useState<RequestPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhase('idle');
    setError(null);
  };

  /** Mint the request NFT; returns its global id (`resource:#0#`) or null. */
  const createRequest = async (args: {
    account: string;
    docHash: string;
    disclosure: DisclosurePolicy;
    requiredSigners: string[];
    /** When true the initiator also signs in this same transaction. */
    initiatorSigns: boolean;
    verifyUrl?: string;
  }): Promise<string | null> => {
    setError(null);
    if (!activeNetworkId) {
      setPhase('error');
      setError('wallet_not_connected');
      return null;
    }
    setPhase('creating');
    const manifest = buildSigningRequestManifest({
      accountAddress: args.account,
      docHash: args.docHash,
      networkId: activeNetworkId,
      disclosure: args.disclosure,
      requiredSigners: args.requiredSigners,
      initiatorSigned: args.initiatorSigns,
      verifyUrl: args.verifyUrl,
    });
    const tx = await sendTransaction(manifest);
    if (!tx) {
      setPhase('error');
      setError('onchain_failed');
      return null;
    }
    const resource = tx.createdEntities.find((a) => a.startsWith('resource_'));
    if (!resource) {
      setPhase('error');
      setError('onchain_no_resource');
      return null;
    }
    setPhase('done');
    return `${resource}:#0#`;
  };

  /** Mint the current signer's signature NFT for a request. */
  const sign = async (args: {
    account: string;
    docHash: string;
    requestId: string;
  }): Promise<boolean> => {
    setError(null);
    if (!activeNetworkId) {
      setPhase('error');
      setError('wallet_not_connected');
      return false;
    }
    setPhase('signing');
    const manifest = buildSignatureManifest({
      accountAddress: args.account,
      docHash: args.docHash,
      networkId: activeNetworkId,
      requestId: args.requestId,
    });
    const tx = await sendTransaction(manifest);
    if (!tx) {
      setPhase('error');
      setError('onchain_failed');
      return false;
    }
    setPhase('done');
    return true;
  };

  return { createRequest, sign, phase, error, reset };
}
