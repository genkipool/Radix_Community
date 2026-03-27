import type { DApp } from '../types';

export const DAPP_TAGS = [
  'DEX',
  'DeFi',
  'Lending',
  'Bridge',
  'Launchpad',
  'Aggregator',
  'Infrastructure',
  'NFT',
  'Gaming',
  'Wallet',
] as const;

export const dapps: DApp[] = [
  {
    id: 1,
    name: 'Ociswap',
    description:
      'The leading decentralised exchange on Radix. Swap tokens, provide liquidity and earn yield through concentrated liquidity positions (CLMM). One of the first DeFi protocols built natively on Radix Engine v2.',
    logoUrl: 'https://ociswap.com/img/oci-logo.svg',
    websiteUrl: 'https://ociswap.com',
    tags: ['DEX', 'DeFi'],
    likes: 312,
    dislikes: 8,
    isSponsored: true,
  },
  {
    id: 2,
    name: 'CaviarNine',
    description:
      'Advanced AMM and liquidity protocol on Radix. Offers multi-step swap routing, yield strategies and one of the deepest liquidity pools in the ecosystem. Built by a veteran DeFi team.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1670432064832311298/hFxJnm4F_400x400.jpg',
    websiteUrl: 'https://caviarnine.com',
    tags: ['DEX', 'DeFi'],
    likes: 278,
    dislikes: 5,
    isSponsored: true,
  },
  {
    id: 3,
    name: 'DefiPlaza',
    description:
      'Gas-efficient multi-token DEX. DefiPlaza allows swapping between any two tokens with a single contract and minimal gas costs. Available on Radix with a native Scrypto implementation.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1523303651556421633/ILz7EYrT_400x400.jpg',
    websiteUrl: 'https://radix.defiplaza.net',
    tags: ['DEX', 'DeFi'],
    likes: 198,
    dislikes: 12,
  },
  {
    id: 4,
    name: 'Weft Finance',
    description:
      'Decentralised lending and borrowing protocol on Radix. Deposit collateral, borrow assets and earn interest — all secured by Radix Engine\'s asset-oriented design that eliminates reentrancy vulnerabilities.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1673671696897249280/wRH2sEHa_400x400.jpg',
    websiteUrl: 'https://weft.finance',
    tags: ['Lending', 'DeFi'],
    likes: 221,
    dislikes: 9,
    isSponsored: true,
  },
  {
    id: 5,
    name: 'Astrolescent',
    description:
      'Aggregator and smart order router for the Radix DeFi ecosystem. Astrolescent automatically finds the best swap rate across all DEXes on Radix, splitting orders for optimal execution.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1671882498124713984/YDuiVSF_400x400.jpg',
    websiteUrl: 'https://astrolescent.com',
    tags: ['Aggregator', 'DeFi'],
    likes: 167,
    dislikes: 4,
  },
  {
    id: 6,
    name: 'Instabridge',
    description:
      'Cross-chain bridge incubated by RDX Works. Move assets between Radix, Ethereum and other EVM networks with atomic guarantees. Built with Hyperlane messaging protocol integration.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1739971474611023872/kzsPZS4q_400x400.jpg',
    websiteUrl: 'https://instabridge.io',
    tags: ['Bridge', 'Infrastructure'],
    likes: 245,
    dislikes: 18,
    isSponsored: true,
  },
  {
    id: 7,
    name: 'RadixPump',
    description:
      'Fair-launch token launchpad on Radix. Create and discover new tokens with bonding-curve pricing. Every launch is transparent, on-chain and accessible directly from the Radix Wallet.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1793701539124289537/fFMiXmG0_400x400.jpg',
    websiteUrl: 'https://radixpump.com',
    tags: ['Launchpad', 'DeFi'],
    likes: 189,
    dislikes: 22,
  },
  {
    id: 8,
    name: 'DeXter',
    description:
      'Community-built order-book DEX on Radix. DeXter brings limit orders, stop-losses and professional trading tools to the Radix ecosystem, fully managed and governed by the community.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1664293479076134912/Fo3_LsmX_400x400.jpg',
    websiteUrl: 'https://dexter.exchange',
    tags: ['DEX', 'DeFi'],
    likes: 203,
    dislikes: 7,
  },
  {
    id: 9,
    name: 'Radix Wallet',
    description:
      'The official Radix smart wallet. Biometric login, no seed phrases, and human-readable Transaction Manifests. Available on iOS and Android. The safest entry point into the Radix ecosystem.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1674438048823529473/vKTv0cep_400x400.jpg',
    websiteUrl: 'https://wallet.radixdlt.com',
    tags: ['Wallet', 'Infrastructure'],
    likes: 418,
    dislikes: 3,
    isSponsored: true,
  },
  {
    id: 10,
    name: 'Midas',
    description:
      'Yield vault protocol on Radix. Automatically compound your DeFi returns through optimised vault strategies. Midas integrates with Ociswap and CaviarNine to maximise LP earnings.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1684226025671942144/cX1MHlHD_400x400.jpg',
    websiteUrl: 'https://midas.rip',
    tags: ['DeFi', 'Lending'],
    likes: 144,
    dislikes: 6,
  },
  {
    id: 11,
    name: 'Surge',
    description:
      'High-speed perpetuals and derivatives exchange on Radix. Trade leveraged positions with low fees and deep liquidity, powered by Radix Engine\'s atomic settlement guarantees.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1671511424430415875/LjWoGNaJ_400x400.jpg',
    websiteUrl: 'https://surge.trade',
    tags: ['DEX', 'DeFi'],
    likes: 176,
    dislikes: 14,
  },
  {
    id: 12,
    name: 'Root Finance',
    description:
      'Decentralised credit and lending market on Radix. Root Finance offers under-collateralised lending using on-chain reputation scores, bringing capital efficiency to DeFi on Radix.',
    logoUrl: 'https://pbs.twimg.com/profile_images/1679528095296303104/Xon8IQ2n_400x400.jpg',
    websiteUrl: 'https://rootfinance.xyz',
    tags: ['Lending', 'DeFi'],
    likes: 132,
    dislikes: 9,
  },
];
