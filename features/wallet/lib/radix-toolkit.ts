import { RadixDappToolkit, DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit';
import { NETWORKS, RadixNetworkId } from '../constants/network';

/**
 * Map of RDT instances keyed by network ID.
 * Allows mainnet and stokenet toolkits to coexist without destroying each other.
 */
const rdtInstances = new Map<RadixNetworkId, ReturnType<typeof RadixDappToolkit>>();

/**
 * Get or create a RadixDappToolkit instance for the specified network.
 * Each network gets its own persistent instance that is never destroyed
 * when switching networks.
 */
export const getOrCreateToolkit = (networkId: RadixNetworkId) => {
  if (typeof window === 'undefined') return null;

  // Return existing instance if already created for this network
  const existing = rdtInstances.get(networkId);
  if (existing) return existing;

  const networkConfig = NETWORKS[networkId];

  // Skip creation if dApp address is not configured (e.g., mainnet not yet set up)
  if (!networkConfig.dAppDefinitionAddress) return null;

  const rdt = RadixDappToolkit({
    dAppDefinitionAddress: networkConfig.dAppDefinitionAddress,
    networkId: networkConfig.networkId,
    applicationName: 'Radix Community',
    applicationVersion: '1.0.0',
  });

  // Request at least 1 account and Persona Name (with ROLA proof)
  rdt.walletApi.setRequestData(
    DataRequestBuilder.persona().withProof(),
    DataRequestBuilder.accounts().atLeast(1),
  );

  rdtInstances.set(networkId, rdt);
  return rdt;
};

/**
 * Destroy a specific network's toolkit instance.
 */
export const destroyToolkit = (networkId?: RadixNetworkId) => {
  if (networkId !== undefined) {
    const rdt = rdtInstances.get(networkId);
    if (rdt) {
      rdt.destroy();
      rdtInstances.delete(networkId);
    }
    return;
  }

  // Destroy all instances
  for (const [id, rdt] of rdtInstances) {
    rdt.destroy();
    rdtInstances.delete(id);
  }
};
