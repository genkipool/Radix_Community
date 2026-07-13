'use client';

import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { NETWORKS } from '@/features/wallet/constants/network';
import { downloadBytes } from '@/features/sign/lib/certificate';
import type { CipherErrorCode, ContainerHead } from '../types/cipher.types';
import { parseContainerHead } from '../lib/container';
import { createBlobSink, decryptContainer } from '../lib/decrypt';
import { toCipherErrorCode } from '../lib/errors';
import { useCipherKey } from './useCipherKey';

export type DecryptPhase =
  | 'idle'
  | 'loaded'
  | 'signing'
  | 'decrypting'
  | 'done'
  | 'error';

/**
 * Decrypt tab state machine. Phase 1 (local): the connected wallet IS the
 * sender account, so the key is re-derived by signing again and the file is
 * decrypted in place. The remote request flow (share URL → WebRTC) builds on
 * top of this hook's loaded container state.
 */
export function useDecryptFlow() {
  const { isConnected, accounts, activeNetworkId } = useRadixWallet();
  const { requestKey } = useCipherKey();
  const [file, setFile] = useState<File | null>(null);
  const [head, setHead] = useState<ContainerHead | null>(null);
  const [phase, setPhase] = useState<DecryptPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<CipherErrorCode | null>(null);

  async function loadFile(candidate: File | null): Promise<void> {
    setError(null);
    setProgress(0);
    if (!candidate) {
      setFile(null);
      setHead(null);
      setPhase('idle');
      return;
    }
    try {
      const parsed = await parseContainerHead(candidate);
      setFile(candidate);
      setHead(parsed);
      setPhase('loaded');
    } catch (e) {
      setFile(null);
      setHead(null);
      setError(toCipherErrorCode(e));
      setPhase('error');
    }
  }

  /** The connected wallet holds the account this file is bound to. */
  const senderIsConnected =
    isConnected &&
    head != null &&
    accounts.some((account) => account.address === head.header.senderAccount);

  /** Explicit binding checks so a wrong context fails before the wallet opens. */
  function assertUnlockContext(header: ContainerHead['header']): void {
    if (header.origin !== window.location.origin) throw new Error('origin_mismatch');
    if (activeNetworkId == null || header.networkId !== activeNetworkId) {
      throw new Error('network_mismatch');
    }
    if (
      header.dAppDefinitionAddress !==
      NETWORKS[activeNetworkId].dAppDefinitionAddress
    ) {
      throw new Error('origin_mismatch');
    }
  }

  async function decryptLocally(): Promise<void> {
    if (!file || !head) return;
    setError(null);
    try {
      assertUnlockContext(head.header);
      setPhase('signing');
      const grant = await requestKey(head.header.fileSalt);
      if (grant.account !== head.header.senderAccount) {
        throw new Error('account_mismatch');
      }

      setPhase('decrypting');
      setProgress(0);
      const sink = createBlobSink(head.header.mimeType);
      await decryptContainer(file, grant.keyBits, sink, setProgress);
      downloadBytes(sink.result(), head.header.fileName, head.header.mimeType);
      setPhase('done');
    } catch (e) {
      setError(toCipherErrorCode(e));
      // Keep the parsed container so the user can retry after a wallet hiccup.
      setPhase('loaded');
    }
  }

  function reset(): void {
    setFile(null);
    setHead(null);
    setPhase('idle');
    setProgress(0);
    setError(null);
  }

  return {
    file,
    head,
    phase,
    progress,
    error,
    senderIsConnected,
    loadFile,
    decryptLocally,
    reset,
  };
}
