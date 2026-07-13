'use client';

import { useEffect, useRef, useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { NETWORKS } from '@/features/wallet/constants/network';
import type {
  CipherErrorCode,
  ContainerHead,
  DataChannelMessage,
} from '../types/cipher.types';
import { parseContainerHeadBytes } from '../lib/container';
import { toCipherErrorCode } from '../lib/errors';
import { toHex } from '../lib/keys';
import { createSignaling, type CipherSignaling } from '@/features/p2p/lib/signaling';
import { base64ToBytes } from '../lib/transfer';
import { connectAsGuest, type CipherPeer } from '../lib/peer';
import { useCipherKey } from './useCipherKey';

export type UnlockPhase =
  | 'connecting'
  | 'requestReceived'
  | 'approving'
  | 'keySent'
  | 'rejected'
  | 'error';

export interface UnlockRequest {
  requesterName: string;
  head: ContainerHead;
}

/**
 * Flow B, sender side (guest): the original encryptor opened an unlock URL.
 * The decrypt request arrives over the channel; after explicit approval the
 * wallet signs the file's challenge, the key is re-derived statelessly and
 * released to the requester.
 */
export function useUnlockSession(roomId: string) {
  const { activeNetworkId } = useRadixWallet();
  const { requestKey } = useCipherKey();
  const [phase, setPhase] = useState<UnlockPhase>('connecting');
  const [request, setRequest] = useState<UnlockRequest | null>(null);
  const [error, setError] = useState<CipherErrorCode | null>(null);

  const peerRef = useRef<CipherPeer | null>(null);
  const signalingRef = useRef<CipherSignaling | null>(null);
  const phaseRef = useRef<UnlockPhase>('connecting');

  const moveTo = (next: UnlockPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    let cancelled = false;

    const advance = (next: UnlockPhase) => {
      phaseRef.current = next;
      setPhase(next);
    };

    const handlePeerClose = () => {
      const current = phaseRef.current;
      if (current === 'keySent' || current === 'rejected' || current === 'error') {
        return;
      }
      setError('peer_disconnected');
      advance('error');
    };

    const handleMessage = (message: DataChannelMessage) => {
      if (message.t === 'decrypt-request') {
        try {
          const head = parseContainerHeadBytes(base64ToBytes(message.headB64));
          setRequest({ requesterName: message.requesterName, head });
          advance('requestReceived');
        } catch (e) {
          setError(toCipherErrorCode(e));
          advance('error');
        }
      } else if (message.t === 'bye') {
        handlePeerClose();
      }
    };

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const signaling = await createSignaling(roomId);
          if (cancelled) {
            void signaling.leave();
            return;
          }
          signalingRef.current = signaling;
          const peer = await connectAsGuest(signaling, {
            onMessage: handleMessage,
            onBinary: () => undefined,
            onClose: handlePeerClose,
          });
          if (cancelled) {
            peer.close();
            return;
          }
          peerRef.current = peer;
        } catch (e) {
          if (!cancelled) {
            setError(toCipherErrorCode(e));
            advance('error');
          }
        }
      })();
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      peerRef.current?.close();
      peerRef.current = null;
      void signalingRef.current?.leave();
      signalingRef.current = null;
    };
  }, [roomId]);

  /** Binding checks that must hold before the wallet even opens. */
  function assertUnlockContext(head: ContainerHead): void {
    if (head.header.origin !== window.location.origin) {
      throw new Error('origin_mismatch');
    }
    if (activeNetworkId == null || head.header.networkId !== activeNetworkId) {
      throw new Error('network_mismatch');
    }
    if (
      head.header.dAppDefinitionAddress !==
      NETWORKS[activeNetworkId].dAppDefinitionAddress
    ) {
      throw new Error('origin_mismatch');
    }
  }

  async function approve(): Promise<void> {
    const peer = peerRef.current;
    if (!peer || !request) return;
    setError(null);
    moveTo('approving');
    try {
      assertUnlockContext(request.head);
      const grant = await requestKey(request.head.header.fileSalt);
      if (grant.account !== request.head.header.senderAccount) {
        peer.sendMessage({ t: 'decrypt-denied', reason: 'account_mismatch' });
        throw new Error('account_mismatch');
      }
      peer.sendMessage({ t: 'decrypt-approved', fileKeyHex: toHex(grant.keyBits) });
      moveTo('keySent');
    } catch (e) {
      const code = toCipherErrorCode(e);
      if (code === 'origin_mismatch' || code === 'network_mismatch') {
        peer.sendMessage({ t: 'decrypt-denied', reason: code });
      } else if (code !== 'account_mismatch') {
        peer.sendMessage({ t: 'decrypt-denied', reason: 'wallet_error' });
      }
      setError(code);
      moveTo('requestReceived');
    }
  }

  function deny(): void {
    peerRef.current?.sendMessage({ t: 'decrypt-denied', reason: 'rejected' });
    moveTo('rejected');
  }

  return { phase, request, error, approve, deny };
}
