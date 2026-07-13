import { RadixNetworkId } from '@/features/wallet/constants/network';

/** Human network name recorded in attestation metadata / NF data. */
export function networkNameForId(networkId: number): string {
  return networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}
