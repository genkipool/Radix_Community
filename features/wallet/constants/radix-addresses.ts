import { RadixNetworkId } from './network';

export const RADIX_TOKEN_ADDRESSES: Record<number, { XRD: string; OWNER_BADGE: string }> = {
  [RadixNetworkId.Mainnet]: {
    XRD: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    OWNER_BADGE: 'resource_rdx1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxvdrwnr',
  },
  [RadixNetworkId.Stokenet]: {
    XRD: 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
    OWNER_BADGE: 'resource_tdx_2_1nfxxxxxxxxxxvdrwnrxxxxxxxxx004365253834xxxxxxxxxyerzzk',
  },
};
