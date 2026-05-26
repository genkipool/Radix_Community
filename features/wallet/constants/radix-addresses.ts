import { RadixNetworkId } from './network';

export const RADIX_TOKEN_ADDRESSES: Record<number, { XRD: string }> = {
  [RadixNetworkId.Mainnet]: {
    XRD: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
  },
  [RadixNetworkId.Stokenet]: {
    XRD: 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
  },
};
