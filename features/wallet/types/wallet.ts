import { RadixNetworkId } from '../constants/network';
import type { WalletDataPersonaData } from '@radixdlt/radix-dapp-toolkit';

export interface WalletAccount {
  address: string;
  label: string;
  appearanceId: number;
}

export type WalletPersonaData = WalletDataPersonaData;

export interface RadixWalletState {
  isConnected: boolean;
  isLoading: boolean;
  isExtensionAvailable: boolean;
  accounts: WalletAccount[];
  persona: { identityAddress: string; label: string } | undefined;
  personaData: WalletPersonaData[];
  error: string | null;
  activeNetworkId: RadixNetworkId | null;
}

export interface RadixWalletContextValue extends RadixWalletState {
  connect: (networkId: RadixNetworkId) => void;
  disconnect: () => void;
}
