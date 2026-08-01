/**
 * Resolves a URL path into a labelled breadcrumb trail.
 *
 * Kept separate from `structured-data.ts` so that module stays free of i18n
 * imports: this one knows about dictionaries, that one only knows schema.org.
 *
 * The guiding rule is that a wrong breadcrumb is worse than no breadcrumb. Any
 * segment whose label cannot be resolved from a dictionary aborts the whole
 * trail rather than being guessed at or title-cased from the slug, because a
 * breadcrumb is a claim about site structure that search engines display
 * verbatim in results.
 */
import { getFeatureDictionary, type Locale } from '@/i18n/dictionaries';
import { BASE_URL } from './seo';

export interface Crumb {
  name: string;
  url: string;
}

/**
 * First path segment to the `nav.*` key holding its short label. Reusing the
 * navigation labels means a breadcrumb always reads the same as the menu the
 * visitor clicked, and adds no new translation surface.
 */
const SECTION_LABEL_KEY: Record<string, string> = {
  academy: 'academy',
  blog: 'blog',
  community: 'community',
  console: 'console',
  dapps: 'dapps',
  dashboard: 'dashboard',
  docs: 'doc',
  forum: 'forum',
  games: 'games',
  'google-wallet': 'google_wallet',
  hyperscale: 'hyperscale',
  infrastructure: 'infrastructure',
  seal: 'seal',
};

/** Second-level segments under `/dashboard` that are real pages. */
const DASHBOARD_VIEW_LABEL_KEY: Record<string, 'staking' | 'explorer'> = {
  staking: 'staking',
  explorer: 'explorer',
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Strips the locale prefix and returns the remaining segments.
 * `/en/console/create-token` → `['console', 'create-token']`
 */
function segmentsAfterLocale(pathname: string, locale: string): string[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === locale) parts.shift();
  return parts;
}

/**
 * Builds the trail for a page, or `null` when there is nothing useful or
 * nothing certain to say.
 *
 * Returns `null` for the home page (a single-item breadcrumb is noise), for
 * anything deeper than two segments (the dashboard's entity pages, whose
 * addresses make no sense as crumbs), and for any unresolved label.
 */
export async function resolveBreadcrumbs(
  locale: string,
  pathname: string | null,
): Promise<Crumb[] | null> {
  if (!pathname) return null;

  const segments = segmentsAfterLocale(pathname, locale);
  if (segments.length === 0 || segments.length > 2) return null;

  const [section, child] = segments;
  const labelKey = SECTION_LABEL_KEY[section];
  if (!labelKey) return null;

  // The console's tool titles are the only labels not already in the common
  // dictionary, so that feature is loaded only when the path needs it.
  const t = await getFeatureDictionary(
    locale as Locale,
    section === 'console' ? ['console'] : [],
  );

  const nav = (t.nav ?? {}) as Record<string, unknown>;
  const home = asString((t.breadcrumb as Record<string, unknown>)?.home);
  const sectionName = asString(nav[labelKey]);
  if (!home || !sectionName) return null;

  const crumbs: Crumb[] = [
    { name: home, url: `${BASE_URL}/${locale}` },
    { name: sectionName, url: `${BASE_URL}/${locale}/${section}` },
  ];

  if (!child) return crumbs;

  const childName = resolveChildLabel(t, section, child);
  if (!childName) return null;

  crumbs.push({
    name: childName,
    url: `${BASE_URL}/${locale}/${section}/${child}`,
  });
  return crumbs;
}

function resolveChildLabel(
  t: Record<string, unknown>,
  section: string,
  child: string,
): string | null {
  if (section === 'console') {
    const tools = (t.console as Record<string, unknown>)?.tools as
      | Record<string, { title?: string }>
      | undefined;
    return asString(tools?.[child]?.title);
  }

  if (section === 'community') {
    const areas = (t.community_transparency as Record<string, unknown>)
      ?.area_names as Record<string, string> | undefined;
    return asString(areas?.[child]);
  }

  if (section === 'dashboard') {
    const key = DASHBOARD_VIEW_LABEL_KEY[child];
    if (!key) return null;
    return asString((t.breadcrumb as Record<string, unknown>)?.[key]);
  }

  return null;
}
