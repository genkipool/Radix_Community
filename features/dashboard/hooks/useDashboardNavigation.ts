'use client';

/**
 * The only place the dashboard writes to the URL.
 *
 * Before this, seven scattered `window.history.replaceState` calls edited the
 * address bar behind the router's back. That had three real costs: the server
 * component never re-ran, so changing network, tag or date range silently
 * stopped using the server prefetch; the back button did nothing, because
 * `replaceState` leaves no history entry; and Next's router state drifted away
 * from the actual URL, which is a classic source of a later navigation
 * restoring a stale address.
 *
 * Everything now goes through the router and is built from the route contract,
 * so a URL can only ever be produced one way.
 *
 * `replace` vs `push`: only a deliberate destination (changing view, opening an
 * entity) earns a history entry. Refining what you are looking at — network,
 * dates, tag, typing in the search box — replaces, so the back button steps out
 * of the dashboard instead of walking back through every keystroke.
 */
import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardView, Network } from '../types';
import {
  dashboardRoutes,
  parseDashboardQuery,
  serializeDashboardQuery,
  type DashboardQuery,
  type TxTag,
} from '../lib/routes';

export interface UseDashboardNavigationOptions {
  locale: string;
  /** View currently rendered, so query-only changes stay on their own path. */
  view: DashboardView;
}

export function useDashboardNavigation({ locale, view }: UseDashboardNavigationOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();

  /** View state currently in the URL. */
  const current = (): DashboardQuery =>
    parseDashboardQuery(Object.fromEntries(searchParams.entries()));

  /** The URL as it stands, to compare a destination against. */
  const currentHref = () => {
    const search = searchParams.toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  /**
   * Navigates only when the destination actually differs. Without this, routine
   * UI actions (clearing the search box, clicking a tag) fired a router call and
   * a server round trip to arrive at the URL already on screen.
   */
  const navigate = (href: string, mode: 'push' | 'replace') => {
    if (href === currentHref()) return;
    startNavigation(() =>
      mode === 'push'
        ? router.push(href, { scroll: false })
        : router.replace(href, { scroll: false }),
    );
  };

  /**
   * Keeps the current path (which may be an entity page) and only rewrites the
   * query, so refining a filter never throws you back to the list.
   */
  const replaceQuery = (patch: Partial<DashboardQuery>) => {
    const next = { ...current(), ...patch };
    // On an entity page the entity lives in the path, never in the query.
    const onEntityPage = /\/dashboard\/(tx|resource|account|validator)\//.test(pathname);
    if (onEntityPage) delete next.entity;
    navigate(`${pathname}${serializeDashboardQuery(next)}`, 'replace');
  };

  /**
   * The entity the URL is currently COMMITTED to, which is not the same as the
   * one being typed.
   *
   * Navigations run inside a transition, so during one this still reports the
   * previous entity. That is what lets the entity card survive until its
   * replacement data actually lands, instead of vanishing the instant the search
   * box is cleared and leaving the old filtered transactions on screen alone.
   */
  const committedEntity = (() => {
    const fromPath = /\/dashboard\/(?:tx|resource|account|validator)\/([^/?#]+)/.exec(pathname);
    if (fromPath) return decodeURIComponent(fromPath[1]);
    return current().entity ?? null;
  })();

  return {
    isNavigating,
    committedEntity,

    /**
     * Switches view WITHOUT tearing the dashboard down.
     *
     * A full navigation would unmount the whole client and rebuild it, which is
     * what made switching feel heavy: the shell, the toolbar and every card had
     * to be recreated for what is conceptually a tab change. A shared layout
     * cannot fix that here, because a Next layout never receives `searchParams`
     * and the active network lives in the query string.
     *
     * So the URL is updated through the History API, which Next explicitly
     * patches to keep its router in sync. The address stays canonical and
     * shareable, the back button still works, and nothing remounts. A cold load
     * of either URL is still served by its own route, which is what keeps each
     * view's payload down.
     */
    goToView: (next: DashboardView) => {
      const { network } = current();
      const href = dashboardRoutes.view(locale, next, { network });
      if (href === currentHref()) return;
      window.history.pushState(null, '', href);
    },

    /**
     * Switches ledger. Always lands on the current view's LIST: an entity from
     * one network does not exist on the other, so staying on its page would
     * show an address that cannot resolve.
     *
     * Through the router, NOT the History API.
     *
     * `goToView` gets away with `pushState` because it moves to a different
     * ROUTE. The network lives in the query string of the route already on
     * screen, and rewriting that under the router's feet leaves `useSearchParams`
     * — which `currentHref()` is built from — reporting the old address. The
     * next switch then compares against a stale value and skips writing the URL
     * altogether, so the address said one ledger while the grid showed the
     * other; React also reported a hydration mismatch (#418) each time, from
     * reconciling a server tree that no longer matched the DOM.
     *
     * What made the switch slow was never this call: it was the grid waiting on
     * the transition to commit. That is fixed where it belongs, in what the
     * grid reads (see `useCommittedNetwork`), and the server round trip stays —
     * it is what keeps a reload of this URL correct.
     */
    setNetwork: (network: Network) => {
      navigate(dashboardRoutes.view(locale, view, { network }), 'replace');
    },


    setDateRange: (range: { start: string | null; end: string | null }) => {
      replaceQuery({ start: range.start ?? undefined, end: range.end ?? undefined });
    },

    setTag: (tag: string) => {
      replaceQuery({ tag: (tag as TxTag) || undefined });
    },

    /**
     * Focuses an entity, or clears the focus. Called as the user types, hence
     * `replace`, and only for a complete address: partial text filters on the
     * client without touching the URL.
     *
     * Where that lands depends on the view, because the entity routes all render
     * the EXPLORER focused on an address. Pasting a validator into the staking
     * search box therefore threw the user out of staking and onto the explorer's
     * entity card — the opposite of what searching a list should do.
     *
     * So staking keeps a validator to itself and filters its own list in place,
     * carrying the address in the query so the result is still a shareable link.
     * Anything else has no representation in staking (there is no card for an
     * account or a resource there), so it still goes to the explorer, which is
     * the only view that can show it.
     */
    focusEntity: (value: string | null) => {
      const { network } = current();

      if (!value) {
        navigate(dashboardRoutes.view(locale, view, { network }), 'replace');
        return;
      }

      navigate(dashboardRoutes.entityFocus(locale, view, value, { network }), 'replace');
    },
  };
}
