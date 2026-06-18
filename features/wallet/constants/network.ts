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
    dAppDefinitionAddress: process.env.NEXT_PUBLIC_RADIX_DAPP_ADDRESS_MAINNET || '',
  },
  [RadixNetworkId.Stokenet]: {
    networkId: RadixNetworkId.Stokenet,
    networkName: 'Stokenet',
    dAppDefinitionAddress: process.env.NEXT_PUBLIC_RADIX_DAPP_ADDRESS_TESTNET || 'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk',
  },
};
