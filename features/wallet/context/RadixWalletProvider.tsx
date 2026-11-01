
'use client';

import React, { createContext, useState, type ReactNode } from 'react';
import type {
  RadixWalletContextValue,
  NetworkSessions,
  NetworkSession,
} from '../types/wallet';
import { getOrCreateToolkit, disconnectToolkit } from '../lib/radix-toolkit';
import { cancelWalletRequests, sendToWallet } from '../lib/wallet-requests';
import type { WalletFailure } from '../lib/wallet-errors';
import { RadixNetworkId } from '../constants/network';
import type { SessionPayload } from '@/lib/auth/session';
import { setCookie as writeCookie, getCookie } from '@/utils/cookies';

// ─── Context ────────────────────────────────────────────────────────────────────

export const RadixWalletContext = createContext<RadixWalletContextValue | undefined>(undefined);

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** How long the wallet has to answer a connection before it is cancelled. */
const CONNECT_TIMEOUT_MS = 60_000;

/** What to tell the person when a connection did not go through; nothing when they cancelled it. */
function connectErrorMessage({ reason }: WalletFailure): string | null {
  if (reason === 'cancelled') return null;
  if (reason === 'timeout') return 'Connection timed out. Please try again.';
  return 'Connection rejected or failed.';
}

function networkIdFromName(name: 'mainnet' | 'stokenet'): RadixNetworkId {
  return name === 'mainnet' ? RadixNetworkId.Mainnet : RadixNetworkId.Stokenet;
}

function networkNameFromId(id: RadixNetworkId): 'mainnet' | 'stokenet' {
  return id === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}

/** The ledger last chosen in this browser, or null on the server and when unset. */
function storedNetwork(): 'mainnet' | 'stokenet' | null {
  const stored = getCookie('radix_active_network');
  return stored === 'mainnet' || stored === 'stokenet' ? stored : null;
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
  /** Initial network from cookie to prevent race conditions on remount */
  initialNetwork?: 'mainnet' | 'stokenet' | null;
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
  initialNetwork = null,
}: RadixWalletProviderProps) {
  const [sessions, setSessions] = useState<NetworkSessions>(
    () => sessionsFromPayload(initialSession),
  );
  const [activeNetwork, setActiveNetwork] = useState<'mainnet' | 'stokenet'>(
    () => {
      const initial = sessionsFromPayload(initialSession);
      // `initialNetwork` is the cookie as the server read it when this layout
      // was rendered, and that payload can be older than the page. Switching
      // language remounts this provider from the prefetched `/{otherLocale}`
      // tree, rendered before the last network change, so the stale prop put
      // the console back on the previous ledger and the persist effect below
      // then wrote it into the cookie. In the browser the live cookie is the
      // fresher answer; on a first load it is the same cookie the server read,
      // so hydration still matches.
      //
      // A remembered ledger is kept even without a session on it: someone
      // signed in on Stokenet who switched to browse Mainnet must stay there
      // when the provider remounts (a language switch, a reload). Where the
      // wallet is connected only decides when nothing was chosen.
      const preferred = storedNetwork() ?? initialNetwork;
      if (preferred === 'mainnet' || preferred === 'stokenet') return preferred;
      if (initial.mainnet && initial.stokenet) return 'mainnet';
      if (initial.mainnet) return 'mainnet';
      if (initial.stokenet) return 'stokenet';
      return 'mainnet';
    },
  );

  const initialSessionStr = JSON.stringify(initialSession);
  const stableInitialSession = React.useMemo(() => {
    return JSON.parse(initialSessionStr) as typeof initialSession;
  }, [initialSessionStr]);

  /**
   * A ledger somebody (or some page) has actually CHOSEN, as opposed to the one
   * the last visit happened to leave behind in the cookie.
   *
   * The restore below runs in a `setTimeout(0)`, so it lands AFTER the effects
   * of every component beneath this provider — including a page that opens on
   * the ledger its own URL names. Without this flag the cookie arrived last and
   * won, which is what dragged `?network=stokenet` links onto Mainnet: the page
   * asked for Stokenet on mount, the cookie asserted Mainnet a tick later, and
   * the dashboard read that as a deliberate switch and navigated to it.
   *
   * Once a choice exists the cookie has nothing left to say: it is written from
   * this very state (see the effect below), so it can only ever repeat an older
   * answer to a question that has already been answered.
   */
  const networkChosenRef = React.useRef(false);

  // Restore preferred network from cookie on mount (client-side)
  React.useEffect(() => {
    const stored = getCookie('radix_active_network');
    const initial = sessionsFromPayload(stableInitialSession);

    const timer = setTimeout(() => {
      // A deliberate choice already landed; the cookie is stale by definition.
      if (networkChosenRef.current) return;

      if (stored === 'mainnet' || stored === 'stokenet') {
        // The last choice, whether or not the wallet is connected on it.
        setActiveNetwork(stored);
      } else {
        if (initial.mainnet && !initial.stokenet) {
          setActiveNetwork('mainnet');
        } else if (!initial.mainnet && initial.stokenet) {
          setActiveNetwork('stokenet');
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [stableInitialSession]);

  // Persist selected network to cookie
  React.useEffect(() => {
    writeCookie('radix_active_network', activeNetwork);
  }, [activeNetwork]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountAddresses, setSelectedAccountAddresses] = useState<string[]>([]);

  // ── The connection attempt in progress: a newer one makes older outcomes stale ──
  const connectAttemptRef = React.useRef(0);

  // ── Sync with RDT updates ──
  const subscriptionsRef = React.useRef(new Map<string, { unsubscribe: () => void }>());



  // ── Initialize RDT for networks that have active sessions ──
  React.useEffect(() => {
    const currentSubscriptions = subscriptionsRef.current;

    // For each network with a session, ensure the toolkit is initialized
    // and subscribe to walletData$ to pick up updates from the extension
    const initial = sessionsFromPayload(stableInitialSession);
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
  }, [stableInitialSession]);

  // ── Connect flow ──────────────────────────────────────────────────────────

  function connect(networkId: RadixNetworkId, isUpdate: boolean = false) {
    // One connection at a time: a new one replaces the one still waiting.
    if (isLoading) cancelWalletRequests();
    const attempt = ++connectAttemptRef.current;

    setIsLoading(true);
    setError(null);
    const netName = networkNameFromId(networkId);
    networkChosenRef.current = true;
    setActiveNetwork(netName);

    // Small delay to allow React state to settle before RDT init
    setTimeout(async () => {
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

      const outcome = await sendToWallet(
        rdt,
        'connect',
        () => (isUpdate ? rdt.walletApi.updateSharedAccounts() : rdt.walletApi.sendRequest()),
        { timeoutMs: CONNECT_TIMEOUT_MS },
      );
      if (attempt !== connectAttemptRef.current) return;

      if (!outcome.ok) {
        setIsLoading(false);
        setError(connectErrorMessage(outcome.failure));
        return;
      }

      // ROLA verification happens on the server: a login proves the persona
      // and its accounts, an update (no persona proof) the accounts it shares.
      const walletData = outcome.value;
      const proofs = walletData.proofs ?? [];
      const endpoint = proofs.some((p) => p.type === 'persona')
        ? '/api/auth/radix/verify'
        : '/api/auth/radix/update';
      const requestBody = {
        identityAddress: walletData.persona?.identityAddress,
        networkId,
        accounts: walletData.accounts,
        personaLabel: walletData.persona?.label,
        challenge: proofs[0]?.challenge,
        proofs: proofs.map(({ type, address, proof }) => ({ type, address, proof })),
      };

      try {
        const verifyResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!verifyResponse.ok) {
          const errBody = await verifyResponse.json().catch(() => ({}));
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

        setIsLoading(false);
        setError(null);
      } catch (err) {
        setIsLoading(false);
        setError(err instanceof Error ? err.message : 'Identity verification failed.');
      }
    }, 100);
  }

  /** Cancels the connection waiting for the wallet; the sessions already open stay. */
  function cancelConnection() {
    cancelWalletRequests();
    setIsLoading(false);
    setError(null);
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

  // Stable identity: consumers keep this in effect dependency lists, and a new
  // function every render made those effects re-run for no reason.
  const switchNetwork = React.useCallback((network: 'mainnet' | 'stokenet') => {
    // Every caller is a choice: the toolbar toggle, the wallet popover, the
    // profile modal, or a page whose URL names the ledger it is showing. From
    // here the cookie restore must not undo it.
    networkChosenRef.current = true;
    setActiveNetwork(network);
  }, []);

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
    cancelConnection,
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
