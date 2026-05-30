
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

export function RadixWalletProvider({
  children,
  initialSession = null,
}: RadixWalletProviderProps) {
  const [sessions, setSessions] = useState<NetworkSessions>(
    () => sessionsFromPayload(initialSession),
  );
  const [activeNetwork, setActiveNetwork] = useState<'mainnet' | 'stokenet'>(
    // Default to mainnet, unless only stokenet has a session
    () => {
      const initial = sessionsFromPayload(initialSession);
      if (initial.mainnet) return 'mainnet';
      if (initial.stokenet) return 'stokenet';
      return 'mainnet';
    },
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Connection Timeout Ref ──
  const connectionTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // ── Initialize RDT for networks that have active sessions ──
  React.useEffect(() => {
    // For each network with a session, ensure the toolkit is initialized
    // so walletData$ can pick up reconnections from the extension
    const initial = sessionsFromPayload(initialSession);
    for (const net of ['mainnet', 'stokenet'] as const) {
      if (initial[net]) {
        getOrCreateToolkit(networkIdFromName(net));
      }
    }
  }, [initialSession]);

  // ── Connect flow ──────────────────────────────────────────────────────────

  function connect(networkId: RadixNetworkId) {
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

      // Provide challenge generator
      rdt.walletApi.provideChallengeGenerator(async () => {
        const response = await fetch('/api/auth/radix/challenge', { method: 'POST' });
        const data = await response.json();
        return data.challenge;
      });

      // Provide connect response callback — this is where ROLA verification happens
      rdt.walletApi.provideConnectResponseCallback(async (result) => {
        if (result.isErr()) {
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          setIsLoading(false);
          setError('Connection rejected or failed.');
          return;
        }

        const walletData = result.value;
        const proofs = walletData.proofs;

        if (!proofs || proofs.length === 0) {
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          setIsLoading(false);
          setError('No ROLA proof provided by wallet.');
          return;
        }

        // Verify via backend — this also creates session + sets cookie
        try {
          const verifyResponse = await fetch('/api/auth/radix/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              challenge: proofs[0].challenge,
              proof: proofs[0].proof,
              identityAddress: walletData.persona?.identityAddress,
              networkId,
              accounts: walletData.accounts,
              personaLabel: walletData.persona?.label,
            }),
          });

          if (!verifyResponse.ok) {
            const errBody = await verifyResponse.json().catch(() => ({}));
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
            setIsLoading(false);
            setError((errBody as Record<string, string>).error || 'Verification failed');
            return;
          }

          // Update local state with verified session
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
      });

      // Fire the wallet connection request
      rdt.walletApi.sendRequest();

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
  };

  return (
    <RadixWalletContext.Provider value={contextValue}>
      {children}
    </RadixWalletContext.Provider>
  );
}
