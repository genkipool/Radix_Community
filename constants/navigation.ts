export const NAV_LINKS = [
  {
    key: 'ecosystem',
    path: '/#problema',
    sublinks: [
      { key: 'hyperscale', path: '/hyperscale' },
      { key: 'infrastructure', path: '/infrastructure' },
      { key: 'dapps', path: '/dapps' },
      { key: 'games', path: '/games' },
      { key: 'dashboard', path: '/dashboard' },
    ],
  },
  {
    key: 'developers',
    path: '/#para-devs',
    sublinks: [
      { key: 'doc', path: '/docs' },
      { key: 'academy', path: '/academy' },
      { key: 'console', path: '/console' },
    ],
  },
  {
    key: 'wallet',
    path: '/#wallet',
    sublinks: [
      { key: 'wallet_ios', path: '#' },
      { key: 'wallet_android', path: '#' },
      { key: 'wallet_chrome', path: '#' },
    ],
  },
  {
    key: 'community',
    path: '/#community',
    sublinks: [
      { key: 'blog', path: '/blog' },
      { key: 'forum', path: '/forum' },
      { key: 'community_transparency', path: '/community' },
    ],
  },
  { key: 'roadmap', path: '/#roadmap' },
  { key: 'about', path: '/#about' },
];

export const FOOTER_LINKS = {
  use: [
    { key: 'wallet', path: '#para-ceos' },
    { key: 'dashboard', path: '#para-ceos' },
    { key: 'getXrd', path: '#para-ceos' },
    { key: 'stakeXrd', path: '#para-ceos' },
  ],
  build: [
    { key: 'hub', path: '/docs' },
    { key: 'scrypto', path: '/docs' },
    { key: 'engine', path: '/docs' },
    { key: 'docs', path: '/docs' },
  ],
  ecosystem: [
    { key: 'dapps', path: 'https://apps.apple.com/us/app/radix-wallet/id6448950995' },
    { key: 'tokens', path: 'https://play.google.com/store/apps/details?id=com.radixpublishing.radixwallet.android' },
    { key: 'chrome', path: 'https://chrome.google.com/webstore/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaeplgm' },
    { key: 'validators', path: 'https://www.kucoin.com/trade/XRD-USDT' },
    { key: 'grants', path: '/dashboard' },
  ],
};

export const SOCIAL_LINKS = [
  { icon: 'X', href: 'https://twitter.com/radixdlt' },
  { icon: 'Github', href: 'https://github.com/radixdlt' },
  { icon: 'Discord', href: 'https://discord.gg/radixdlt' },
  { icon: 'Telegram', href: 'https://t.me/radix_dlt' },
  { icon: 'Youtube', href: 'https://www.youtube.com/c/radixdlt' },
];
