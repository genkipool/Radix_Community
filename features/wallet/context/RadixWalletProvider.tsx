
'use client';

import React, { createContext, useState, type ReactNode } from 'react';
import type {
  RadixWalletContextValue,
  NetworkSessions,
  NetworkSession,
} from '../types/wallet';
import { getOrCreateToolkit, disconnectToolkit } from '../lib/radix-toolkit';
import { RadixNetworkId } from '../constants/network';
import type { SessionPayload } from '@/lib/auth/session';
import { setCookie as writeCookie, getCookie } from '@/utils/cookies';

// ─── Context ────────────────────────────────────────────────────────────────────

export const RadixWalletContext = createContext<RadixWalletContextValue | undefined>(undefined);

// ─── Helpers ────────────────────────────────────────────────────────────────────

function networkIdFromName(name: 'mainnet' | 'stokenet'): RadixNetworkId {
  return name === 'mainnet' ? RadixNetworkId.Mainnet : RadixNetworkId.Stokenet;
}

function networkNameFromId(id: RadixNetworkId): 'mainnet' | 'stokenet' {
  return id === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}

/** Convert server session payload into client-side NetworkSessions. */
function sessionsFromPayload(payload: SessionPayload | null): NetworkSessions {
  if (!payload) return { mainnet: null, stokenet: null };
  return {
    mainnet: payload.mainnet
      ? {
          identityAddress: payload.mainnet.identityAddress,
          personaLabel: payload.mainnet.personaLabel,
          accounts: payload.mainnet.accounts,
        }
      : null,
    stokenet: payload.stokenet
      ? {
          identityAddress: payload.stokenet.identityAddress,
          personaLabel: payload.stokenet.personaLabel,
          accounts: payload.stokenet.accounts,
        }
      : null,
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────────

interface RadixWalletProviderProps {
  children: ReactNode;
  /** Server-side session data passed from layout via cookie verification. */
  initialSession?: SessionPayload | null;
}

function subscribeToNetwork(
  netName: 'mainnet' | 'stokenet',
  setSessions: React.Dispatch<React.SetStateAction<NetworkSessions>>,
  subscriptionsRef: React.MutableRefObject<Map<string, { unsubscribe: () => void }>>
) {
  if (subscriptionsRef.current.has(netName)) return;

  const rdt = getOrCreateToolkit(networkIdFromName(netName));
  if (!rdt) return;

  const sub = rdt.walletApi.walletData$.subscribe((walletData) => {
    setSessions(prev => {
      const currentSession = prev[netName];
      if (!currentSession) return prev;

      const newAccounts = walletData.accounts || [];
      const oldAccounts = currentSession.accounts || [];
      
      const isSame = newAccounts.length === oldAccounts.length &&
                     newAccounts.every((acc, i) => acc.address === oldAccounts[i].address);
                     
      if (isSame) return prev;

      return {
        ...prev,
        [netName]: {
          ...currentSession,
          identityAddress: walletData.persona?.identityAddress || currentSession.identityAddress,
          personaLabel: walletData.persona?.label || currentSession.personaLabel,
          accounts: newAccounts,
        }
      };
    });
  });

  subscriptionsRef.current.set(netName, sub);
}

export function RadixWalletProvider({
  children,
  initialSession = null,
}: RadixWalletProviderProps) {
  const [sessions, setSessions] = useState<NetworkSessions>(
    () => sessionsFromPayload(initialSession),
  );
  const [activeNetwork, setActiveNetwork] = useState<'mainnet' | 'stokenet'>(
    // Server-side default (no localStorage available to prevent hydration mismatch)
    () => {
      const initial = sessionsFromPayload(initialSession);
      if (initial.mainnet && initial.stokenet) return 'mainnet';
      if (initial.mainnet) return 'mainnet';
      if (initial.stokenet) return 'stokenet';
      return 'mainnet';
    },
  );

  // Restore preferred network from cookie on mount (client-side)
  React.useEffect(() => {
    const stored = getCookie('radix_active_network');
    const initial = sessionsFromPayload(initialSession);

    const timer = setTimeout(() => {
      if (stored === 'mainnet' || stored === 'stokenet') {
        if (stored === 'mainnet' && initial.mainnet) {
          setActiveNetwork('mainnet');
        } else if (stored === 'stokenet' && initial.stokenet) {
          setActiveNetwork('stokenet');
        } else if (initial.mainnet && !initial.stokenet) {
          setActiveNetwork('mainnet');
        } else if (!initial.mainnet && initial.stokenet) {
          setActiveNetwork('stokenet');
        } else if (!initial.mainnet && !initial.stokenet) {
          setActiveNetwork(stored); // Remember UI selection even when disconnected
        }
      } else {
        if (initial.mainnet && !initial.stokenet) {
          setActiveNetwork('mainnet');
        } else if (!initial.mainnet && initial.stokenet) {
          setActiveNetwork('stokenet');
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [initialSession]);

  // Persist selected network to cookie
  React.useEffect(() => {
    writeCookie('radix_active_network', activeNetwork);
  }, [activeNetwork]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountAddresses, setSelectedAccountAddresses] = useState<string[]>([]);

  // ── Connection Timeout Ref ──
  const connectionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // ── Sync with RDT updates ──
  const subscriptionsRef = React.useRef(new Map<string, { unsubscribe: () => void }>());



  // ── Initialize RDT for networks that have active sessions ──
  React.useEffect(() => {
    const currentSubscriptions = subscriptionsRef.current;

    // For each network with a session, ensure the toolkit is initialized
    // and subscribe to walletData$ to pick up updates from the extension
    const initial = sessionsFromPayload(initialSession);
    for (const net of ['mainnet', 'stokenet'] as const) {
      if (initial[net]) {
        getOrCreateToolkit(networkIdFromName(net));
        subscribeToNetwork(net, setSessions, subscriptionsRef);
      }
    }

    return () => {
      currentSubscriptions.forEach(sub => sub.unsubscribe());
      currentSubscriptions.clear();
    };
  }, [initialSession]);

  // ── Connect flow ──────────────────────────────────────────────────────────

  function connect(networkId: RadixNetworkId, isUpdate: boolean = false) {
    // If a connection is already in progress, cancel the previous one
    if (isLoading) {
      disconnectToolkit(networkId);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    }

    setIsLoading(true);
    setError(null);
    const netName = networkNameFromId(networkId);
    setActiveNetwork(netName);

    // Small delay to allow React state to settle before RDT init
    setTimeout(() => {
      const rdt = getOrCreateToolkit(networkId);
      if (!rdt) {
        setIsLoading(false);
        setError('Wallet toolkit failed to initialize. Check dApp address configuration.');
        return;
      }

      subscribeToNetwork(netName, setSessions, subscriptionsRef);

      // Provide challenge generator
      rdt.walletApi.provideChallengeGenerator(async () => {
        const response = await fetch('/api/auth/radix/challenge', { method: 'POST' });
        const data = await response.json();
        return data.challenge;
      });

      // The callback that processes wallet responses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleWalletResponse = async (result: any) => {
        if (result.isErr()) {
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          setIsLoading(false);
          setError('Connection rejected or failed.');
          return;
        }

        const walletData = result.value;
        const proofs = walletData.proofs;

        let endpoint = '/api/auth/radix/verify';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let requestBody: any = {
          identityAddress: walletData.persona?.identityAddress,
          networkId,
          accounts: walletData.accounts,
          personaLabel: walletData.persona?.label,
        };

        if (!proofs || proofs.length === 0) {
          // If no proof is provided (e.g. during an update flow), try hitting the update endpoint
          // instead of verify. The update endpoint relies on the existing secure cookie.
          endpoint = '/api/auth/radix/update';
        } else {
          // If proof is provided, hit verify
          requestBody.challenge = proofs[0].challenge;
          requestBody.proof = proofs[0].proof;
        }

        try {
          const verifyResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (!verifyResponse.ok) {
            const errBody = await verifyResponse.json().catch(() => ({}));
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
            setIsLoading(false);
            setError((errBody as Record<string, string>).error || (endpoint === '/api/auth/radix/update' ? 'Update failed' : 'Verification failed'));
            return;
          }

          const newSession: NetworkSession = {
            identityAddress: walletData.persona?.identityAddress || '',
            personaLabel: walletData.persona?.label || '',
            accounts: walletData.accounts,
          };

          setSessions(prev => ({
            ...prev,
            [netName]: newSession,
          }));

          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          setIsLoading(false);
          setError(null);
        } catch (err) {
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          setIsLoading(false);
          setError(err instanceof Error ? err.message : 'Identity verification failed.');
        }
      };

      // Provide connect response callback — this is where ROLA verification happens
      rdt.walletApi.provideConnectResponseCallback(handleWalletResponse);

      // Fire the wallet connection request
      if (isUpdate) {
        rdt.walletApi.updateSharedAccounts().map(walletData => ({
          isErr: () => false,
          value: walletData
        })).mapErr(err => ({
          isErr: () => true,
          error: err
        })).then(handleWalletResponse);
      } else {
        rdt.walletApi.sendRequest();
      }

      // Timeout after 60 seconds
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      
      connectionTimeoutRef.current = setTimeout(() => {
        setIsLoading(prev => {
          if (prev) {
            setError('Connection timed out. Please try again.');
            disconnectToolkit(networkId); // Cancel the pending request in the wallet
            return false;
          }
          return prev;
        });
      }, 60000);
    }, 100);
  }

  // ── Disconnect flow ───────────────────────────────────────────────────────

  async function disconnect(network?: 'mainnet' | 'stokenet' | 'all') {
    const target = network || 'all';

    // Disconnect RDT instance(s)
    if (target === 'all') {
      disconnectToolkit();
    } else {
      disconnectToolkit(networkIdFromName(target));
    }

    // Call logout API to update cookie
    try {
      await fetch('/api/auth/radix/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: target }),
      });
    } catch {
      // Cookie clear is best-effort; local state will still be cleaned
    }

    // Update local state
    if (target === 'all') {
      setSessions({ mainnet: null, stokenet: null });
    } else {
      setSessions(prev => ({ ...prev, [target]: null }));

      // If we disconnected the active network and the other has a session, switch
      setActiveNetwork(prev => {
        if (prev === target) {
          const other = target === 'mainnet' ? 'stokenet' : 'mainnet';
          return other;
        }
        return prev;
      });
    }

    setError(null);
    setIsLoading(false);
  }

  // ── Switch network (UI only, no reconnection) ─────────────────────────────

  function switchNetwork(network: 'mainnet' | 'stokenet') {
    setActiveNetwork(network);
  }

  // ── Derive backward-compatible values from active session ─────────────────

  const activeSession = sessions[activeNetwork];

  const contextValue: RadixWalletContextValue = {
    // Multi-session state
    sessions,
    activeNetwork,
    isLoading,
    isExtensionAvailable: true,
    error,
    selectedAccountAddresses,

    // Backward-compatible derived values
    isConnected: activeSession !== null,
    accounts: activeSession?.accounts ?? [],
    persona: activeSession
      ? { identityAddress: activeSession.identityAddress, label: activeSession.personaLabel }
      : undefined,
    personaData: [],
    activeNetworkId: activeSession
      ? networkIdFromName(activeNetwork)
      : null,

    // Actions
    connect,
    disconnect,
    switchNetwork,
    setSelectedAccountAddresses,
  };

  return (
    <RadixWalletContext.Provider value={contextValue}>
      {children}
    </RadixWalletContext.Provider>
  );
}
