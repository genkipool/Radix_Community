import { RadixNetworkId } from '../constants/network';
import type { WalletDataPersonaData } from '@radixdlt/radix-dapp-toolkit';

// ─── Base types ─────────────────────────────────────────────────────────────────

export interface WalletAccount {
  address: string;
  label: string;
  appearanceId: number;
}

export type WalletPersonaData = WalletDataPersonaData;

// ─── Multi-network session ──────────────────────────────────────────────────────

/** Session data for a single network (mainnet OR stokenet). */
export interface NetworkSession {
  identityAddress: string;
  personaLabel: string;
  accounts: WalletAccount[];
}

/** Both network sessions, keyed by network name. */
export type NetworkSessions = Record<'mainnet' | 'stokenet', NetworkSession | null>;

// ─── State ──────────────────────────────────────────────────────────────────────

export interface RadixWalletState {
  /** Session data per network */
  sessions: NetworkSessions;

  /** Currently selected network in the UI */
  activeNetwork: 'mainnet' | 'stokenet';

  /** Loading state during connect flow */
  isLoading: boolean;

  /** Whether the Radix Wallet extension is available */
  isExtensionAvailable: boolean;

  /** Current error message, if any */
  error: string | null;

  // ── Derived / backward-compatible properties ──
  // These are computed from sessions[activeNetwork] for convenience

  /** Whether the active network has a verified session */
  isConnected: boolean;

  /** Accounts for the active network */
  accounts: WalletAccount[];

  /** Persona for the active network */
  persona: { identityAddress: string; label: string } | undefined;

  /** Persona data (extended, from RDT) */
  personaData: WalletPersonaData[];

  /** Active network ID (numeric, for backward compat with staking hooks) */
  activeNetworkId: RadixNetworkId | null;
}

// ─── Context value ──────────────────────────────────────────────────────────────

export interface RadixWalletContextValue extends RadixWalletState {
  /** Start ROLA connection flow for a specific network */
  connect: (networkId: RadixNetworkId) => void;

  /** Disconnect from a specific network (or all if no arg) */
  disconnect: (network?: 'mainnet' | 'stokenet' | 'all') => void;

  /** Switch the UI active network without reconnecting */
  switchNetwork: (network: 'mainnet' | 'stokenet') => void;
}
