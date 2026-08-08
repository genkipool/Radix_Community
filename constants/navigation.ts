/**
 * Paths that open a modal instead of going anywhere. Their click handler calls
 * `preventDefault`, so they are the one kind of link `localizeHref` must leave
 * alone.
 */
export const MODAL_PATHS = ['#pilot', '#under-construction'] as const;

export type ModalPath = (typeof MODAL_PATHS)[number];

export const isModalPath = (path: string): path is ModalPath =>
  (MODAL_PATHS as readonly string[]).includes(path);

/**
 * Turns a link declared here into an href for the current language.
 *
 * A bare `#section` is an anchor of the home page, not of whichever page is
 * showing the link: written as-is it pointed at an element that only exists on
 * the home page, so from /docs or /dashboard the footer's section links did
 * nothing at all. They are resolved against the localized home instead.
 */
export const localizeHref = (path: string, language: string): string => {
  if (path.startsWith('http') || path === '#' || isModalPath(path)) return path;
  const home = `/${language}`;
  if (path.startsWith('#')) return `${home}/${path}`;
  const route = path.startsWith('/') ? path : `/${path}`;
  return `${home}${route === '/' ? '' : route}`;
};

export const NAV_LINKS = [
  {
    key: 'ecosystem',
    path: '/#problema',
    sublinks: [
      { key: 'infrastructure', path: '/infrastructure' },
      { key: 'hyperscale', path: '/hyperscale' },
      { key: 'seal', path: '/seal' },
      { key: 'google_wallet', path: '/google-wallet' },
      { key: 'dapps', path: '/dapps' },
      { key: 'games', path: '/games' },
      { key: 'dashboard', path: '/dashboard/staking' },
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
    ],
  },
  {
    key: 'roadmap',
    path: '/#roadmap',
    sublinks: [
      { key: 'roadmap_radix', path: '/#roadmap' },
      { key: 'roadmap_hyperscale', path: '/hyperscale#xian-roadmap' },
    ],
  },
  {
    key: 'about',
    path: '/#about',
    sublinks: [
      { key: 'about_us', path: '/#about' },
      { key: 'community_transparency', path: '/community' },
    ],
  },
];

export const FOOTER_LINKS = {
  institutions: [
    { key: 'pilot', path: '#pilot' },
    { key: 'dvp', path: '#para-ceos' },
    { key: 'kyc', path: '#para-ceos' },
    { key: 'rwa', path: '#para-ceos' },
    { key: 'seal', path: '/seal' },
    { key: 'google_wallet', path: '/google-wallet' },
  ],
  developers: [
    { key: 'docs', path: '/docs' },
    { key: 'academy', path: '/academy' },
    { key: 'console', path: '/console' },
    { key: 'hyperscale', path: '/hyperscale' },
    { key: 'wiki', path: 'https://radix.wiki' },
  ],
  users: [
    { key: 'wallet_ios', path: 'https://apps.apple.com/us/app/radix-wallet/id6448950995' },
    { key: 'wallet_android', path: 'https://play.google.com/store/apps/details?id=com.radixpublishing.radixwallet.android' },
    { key: 'wallet_chrome', path: 'https://chrome.google.com/webstore/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaeplgm' },
    { key: 'buy_xrd', path: 'https://www.kucoin.com/trade/XRD-USDT' },
    { key: 'staking', path: '/dashboard/staking' },
  ],
};

export const SOCIAL_LINKS = [
  { icon: 'X', href: 'https://twitter.com/radixdlt' },
  { icon: 'Github', href: 'https://github.com/radixdlt' },
  { icon: 'Discord', href: 'https://discord.gg/radixdlt' },
  { icon: 'Telegram', href: 'https://t.me/radix_dlt' },
  { icon: 'Youtube', href: 'https://www.youtube.com/c/radixdlt' },
];
