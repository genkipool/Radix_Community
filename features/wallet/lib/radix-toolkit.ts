import { RadixDappToolkit, DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit';
// ConnectButtonNoopModule is not needed if we don't render the default button.
import { NETWORKS, RadixNetworkId } from '../constants/network';

// Singleton instance to prevent memory leaks in dev
let rdtInstance: ReturnType<typeof RadixDappToolkit> | null = null;
let currentNetworkId: RadixNetworkId | null = null;

export const getOrCreateToolkit = (networkId: RadixNetworkId) => {
  if (typeof window === 'undefined') return null;

  // If we already have an instance and the network hasn't changed, return it
  if (rdtInstance && currentNetworkId === networkId) {
    return rdtInstance;
  }

  // If changing networks, destroy the previous instance
  if (rdtInstance) {
    rdtInstance.destroy();
  }

  const networkConfig = NETWORKS[networkId];

  rdtInstance = RadixDappToolkit({
    dAppDefinitionAddress: networkConfig.dAppDefinitionAddress,
    networkId: networkConfig.networkId,
    applicationName: 'Radix Community',
    applicationVersion: '1.0.0',
  });

  currentNetworkId = networkId;

  // Request at least 1 account and Persona Name (with ROLA proof)
  rdtInstance.walletApi.setRequestData(
    DataRequestBuilder.persona().withProof(),
    DataRequestBuilder.accounts().atLeast(1)
  );

  return rdtInstance;
};

export const destroyToolkit = () => {
  if (rdtInstance) {
    rdtInstance.destroy();
    rdtInstance = null;
    currentNetworkId = null;
  }
};
