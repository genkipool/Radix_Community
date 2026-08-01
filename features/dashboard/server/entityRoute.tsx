/**
 * Factory for the dashboard's entity routes.
 *
 * Every entity kind renders the same thing (the explorer, focused on that
 * address) and differs only in its URL segment and how its metadata reads, so
 * each route file is three lines and adding a new kind costs one folder. The
 * alternative — a copy of this logic per kind — is exactly how the old
 * hand-built dashboard URLs drifted out of sync.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DashboardPageShell } from './dashboardPage';
import { buildEntityMetadata } from './entityMetadata';
import {
  parseDashboardQuery,
  resolveEntityKind,
  type EntityKind,
  type RawSearchParams,
} from '../lib/routes';
import type { DashboardView, Network } from '@/features/dashboard/types';

const SITE_NAME = 'Radix Community';

interface RouteParams {
  locale: string;
  address: string;
}

export interface EntityRouteConfig {
  /** Entity kind this route serves. */
  kind: EntityKind;
  /** URL segment, used to build the canonical path. */
  segment: string;
  /**
   * Extra prefixes this route accepts beyond the ones that map to `kind`.
   * Transactions, for instance, live under both `txid_` and
   * `transactionintent_`.
   */
  extraKinds?: EntityKind[];
  /**
   * Dashboard view this entity belongs in. Defaults to the explorer, which is
   * right for a transaction or a resource. A validator is a staking subject
   * before it is a stream of transactions, so its route opens the staking view
   * with that validator as the filter.
   */
  view?: DashboardView;
}

export function createEntityRoute({
  kind,
  segment,
  extraKinds = [],
  view = 'transactions',
}: EntityRouteConfig) {
  const accepted = new Set<EntityKind>([kind, ...extraKinds]);

  /**
   * The address must actually be of this kind: `/resource/account_rdx1…` is a
   * 404, not a page rendering the wrong entity under a lying URL.
   */
  const assertKind = (address: string) => {
    const actual = resolveEntityKind(address);
    if (!actual || !accepted.has(actual)) notFound();
  };

  const networkOf = (searchParams: RawSearchParams): Network =>
    parseDashboardQuery(searchParams).network ?? 'mainnet';

  async function generateMetadata({
    params,
    searchParams,
  }: {
    params: Promise<RouteParams>;
    searchParams: Promise<RawSearchParams>;
  }): Promise<Metadata> {
    const [{ locale, address }, search] = await Promise.all([params, searchParams]);
    const value = decodeURIComponent(address);
    if (!resolveEntityKind(value)) return { title: SITE_NAME };
    return buildEntityMetadata({
      locale,
      kind,
      address: value,
      network: networkOf(search),
      path: `/dashboard/${segment}/${value}`,
      siteName: SITE_NAME,
    });
  }

  async function Page({
    params,
    searchParams,
  }: {
    params: Promise<RouteParams>;
    searchParams: Promise<RawSearchParams>;
  }) {
    const [{ locale, address }, search] = await Promise.all([params, searchParams]);
    const value = decodeURIComponent(address);
    assertKind(value);
    // The entity lives in the PATH here, so it is injected into the query the
    // shell understands; the shell keeps one way of focusing a view, whichever
    // view the entity belongs to.
    return (
      <DashboardPageShell
        locale={locale}
        view={view}
        searchParams={{ ...search, entity: value }}
      />
    );
  }

  return { generateMetadata, Page };
}
