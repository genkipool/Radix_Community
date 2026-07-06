export enum RadixNetworkId {
  Mainnet = 1,
  Stokenet = 2,
}

export interface RadixNetworkConfig {
  networkId: RadixNetworkId;
  networkName: string;
  dAppDefinitionAddress: string;
}

export const NETWORKS: Record<number, RadixNetworkConfig> = {
  [RadixNetworkId.Mainnet]: {
    networkId: RadixNetworkId.Mainnet,
    networkName: 'Mainnet',
    dAppDefinitionAddress:
      process.env.NEXT_PUBLIC_RADIX_DAPP_ADDRESS_MAINNET ||
      // Fallback to the on-chain Radix Community dApp definition (its
      // claimed_websites match RADIX_COMMUNITY_ORIGIN) so mainnet signing is
      // never silently "unverified" if the env var is missing in production.
      'account_rdx1283533slsjtx5r5efdj8c9864vsrg3p3vrw9cr25qyq8f0adlvvuc7',
  },
  [RadixNetworkId.Stokenet]: {
    networkId: RadixNetworkId.Stokenet,
    networkName: 'Stokenet',
    dAppDefinitionAddress: process.env.NEXT_PUBLIC_RADIX_DAPP_ADDRESS_STOKENET || 'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk',
  },
};
