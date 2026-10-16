/**
 * Which network a Radix address belongs to, read from its bech32 prefix:
 * `…_rdx1…` is mainnet and `…_tdx_2_1…` is Stokenet.
 */
export type AddressNetwork = 'mainnet' | 'stokenet';

export function networkOfAddress(address: string): AddressNetwork | null {
  const value = address.trim();
  if (/^[a-z_]+_rdx1[0-9a-z]+$/.test(value)) return 'mainnet';
  if (/^[a-z_]+_tdx_2_1[0-9a-z]+$/.test(value)) return 'stokenet';
  return null;
}

/** The address's network when it is not the active one, else null. */
export function otherNetworkOf(address: string, active: AddressNetwork): AddressNetwork | null {
  const network = networkOfAddress(address);
  return network && network !== active ? network : null;
}
