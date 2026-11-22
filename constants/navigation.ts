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

export interface NavSublink {
  key: string;
  path: string;
  descKey: string;
  isHashLink?: boolean;
}

export interface NavLinkGroup {
  key: string;
  path: string;
  sublinks: NavSublink[];
}

export const isExternalHref = (href: string): boolean => /^https?:\/\//.test(href);

export const resolveNavSublinkHref = (
  sub: Pick<NavSublink, 'key' | 'path'>,
  language: string,
  activeNetwork?: string,
): string => {
  if (sub.key === 'social_telegram' && language === 'es') {
    return 'https://t.me/radix_spanish';
  }
  const rawPath =
    sub.key === 'dashboard' && activeNetwork === 'stokenet'
      ? '/dashboard/staking?network=stokenet'
      : sub.path;
  return localizeHref(rawPath, language);
};

export const NAV_LINKS: NavLinkGroup[] = [
  {
    key: 'ecosystem',
    path: '/#problema',
    sublinks: [
      { key: 'infrastructure', path: '/infrastructure', descKey: 'popup_eco_infra_desc' },
      { key: 'dashboard', path: '/dashboard/staking', descKey: 'popup_eco_dashboard_desc' },
      { key: 'hyperscale', path: '/hyperscale', descKey: 'popup_eco_hyperscale_desc' },
      { key: 'seal', path: '/seal', descKey: 'popup_eco_seal_desc' },
      { key: 'google_wallet', path: '/google-wallet', descKey: 'popup_eco_google_wallet_desc' },
      { key: 'dapps', path: '/dapps', descKey: 'popup_eco_dapps_desc' },
      { key: 'games', path: '/games', descKey: 'popup_dev_games_desc' },
      { key: 'astrolescent', path: 'https://astrolescent.com/', descKey: 'popup_eco_astro_desc' },
    ],
  },
  {
    key: 'developers',
    path: '/#para-devs',
    sublinks: [
      { key: 'console', path: '/console', descKey: 'popup_dev_console_desc' },
      { key: 'wiki', path: 'https://radix.wiki', descKey: 'popup_dev_wiki_desc' },
      { key: 'doc', path: '/docs', descKey: 'popup_dev_docs_desc' },
      { key: 'academy', path: '/academy', descKey: 'popup_dev_academy_desc' },
    ],
  },
  {
    key: 'wallet',
    path: '/#wallet',
    sublinks: [
      { key: 'wallet_ios', path: 'https://apps.apple.com/us/app/radix-wallet/id6448950995', descKey: 'popup_wallet_ios_desc' },
      { key: 'wallet_android', path: 'https://play.google.com/store/apps/details?id=com.radixpublishing.radixwallet.android', descKey: 'popup_wallet_android_desc' },
      { key: 'wallet_chrome', path: 'https://chrome.google.com/webstore/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaeplgm', descKey: 'popup_wallet_chrome_desc' },
      { key: 'wallet_buy_xrd', path: '/#comprar-xrd', descKey: 'popup_wallet_buy_xrd_desc', isHashLink: true },
      { key: 'gumball_club', path: 'https://gumball-club.radixdlt.com/', descKey: 'popup_wallet_gumball_desc' },
    ],
  },
  {
    key: 'community',
    path: '/#community',
    sublinks: [
      { key: 'governance', path: '/governance', descKey: 'popup_com_governance_desc' },
      { key: 'blog', path: '/blog', descKey: 'popup_com_blog_desc' },
      { key: 'forum', path: '/forum', descKey: 'popup_com_forum_desc' },
      { key: 'social_youtube', path: 'https://www.youtube.com/c/radixdlt', descKey: 'popup_soc_yt_desc' },
      { key: 'social_x', path: 'https://twitter.com/radixdlt', descKey: 'popup_soc_x_desc' },
      { key: 'social_telegram', path: 'https://t.me/radix_dlt', descKey: 'popup_soc_tg_desc' },
      { key: 'social_discord', path: 'https://discord.gg/radixdlt', descKey: 'popup_soc_discord_desc' },
    ],
  },
  {
    key: 'roadmap',
    path: '/#roadmap',
    sublinks: [
      { key: 'roadmap_radix', path: '/#roadmap', descKey: 'popup_roadmap_radix_desc', isHashLink: true },
      { key: 'roadmap_hyperscale', path: '/hyperscale#xian-roadmap', descKey: 'popup_roadmap_hyper_desc', isHashLink: true },
    ],
  },
  {
    key: 'about',
    path: '/#about',
    sublinks: [
      { key: 'about_us', path: '/#about', descKey: 'popup_about_us_desc', isHashLink: true },
      { key: 'radix_dao', path: '/radix-dao', descKey: 'popup_about_radix_dao_desc' },
      { key: 'community_transparency', path: '/community', descKey: 'popup_com_transparency_desc' },
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
    { key: 'mcp', path: '/console/mcp' },
    { key: 'hyperscale', path: '/hyperscale' },
    { key: 'wiki', path: 'https://radix.wiki' },
  ],
  users: [
    { key: 'wallet_ios', path: 'https://apps.apple.com/us/app/radix-wallet/id6448950995' },
    { key: 'wallet_android', path: 'https://play.google.com/store/apps/details?id=com.radixpublishing.radixwallet.android' },
    { key: 'wallet_chrome', path: 'https://chrome.google.com/webstore/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaeplgm' },
    { key: 'buy_xrd', path: 'https://www.kucoin.com/trade/XRD-USDT' },
    { key: 'staking', path: '/dashboard/staking' },
    { key: 'governance', path: '/governance' },
    { key: 'radix_dao', path: '/radix-dao' },
  ],
};

export const SOCIAL_LINKS = [
  { icon: 'X', href: 'https://twitter.com/radixdlt' },
  { icon: 'Github', href: 'https://github.com/radixdlt' },
  { icon: 'Discord', href: 'https://discord.gg/radixdlt' },
  { icon: 'Telegram', href: 'https://t.me/radix_dlt' },
  { icon: 'Youtube', href: 'https://www.youtube.com/c/radixdlt' },
];
