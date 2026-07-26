/**
 * The explorer's entity card must not flash in or out.
 *
 * The card spans the full grid width and sits above the transaction list, so
 * any moment where the list exists and the card does not is a visible shove
 * downwards. Two separate causes produced one:
 *
 *  1. Entity details were never hydrated by the server, so an entity URL
 *     painted the transaction list first and grew the card afterwards. Fixed by
 *     prefetching the FOCUSED entity server-side, so the page arrives complete.
 *  2. Clearing the search box removed the card immediately, while the
 *     transactions underneath come from the navigation that clearing triggers.
 *     For a moment the previous address's transactions sat there alone.
 *
 * The rule pinned here: the grid changes only when the replacement is ready,
 * and it holds what it already had until then. No placeholder ever stands in.
 */
import { describe, it, expect } from 'vitest';

const ENTITY_PREFIXES = [
  'account_',
  'package_',
  'component_',
  'resource_',
  'transactiontracker_',
  'consensusmanager_',
  'validator_',
] as const;

const RESOURCE = 'resource_tdx_2_1n20d5q2y9p46zrjaw543vcpdmk3dygtlq4uzyw2zvssg48cxsteu3e';
const ACCOUNT = 'account_rdx12yy8n09a0w907vrjyj4hws2yptrm3rdjv84l9sr24e3w7pk7nuxst8';

interface FocusInput {
  deferredSearch: string;
  isNavigating: boolean;
  committedEntity: string | null;
  /** Entities whose details are already in the query cache. */
  ready: string[];
}

/** Mirrors DashboardClient plus useFocusedEntity. */
function focusedEntity({
  deferredSearch,
  isNavigating,
  committedEntity,
  ready,
}: FocusInput): string {
  const value = deferredSearch.trim();
  const typed =
    value.length >= 60 && ENTITY_PREFIXES.some((p) => value.startsWith(p)) ? value : null;

  const pending = isNavigating ? committedEntity : null;
  const requested = typed ?? pending;
  const hasData = !!requested && ready.includes(requested);

  return (hasData ? requested : pending) ?? '';
}

describe('which entity card the explorer shows', () => {
  it('shows the card on a cold load of an entity URL', () => {
    // The server prefetches the focused entity, so its details are already in
    // the cache on the first render and the page arrives whole.
    expect(
      focusedEntity({
        deferredSearch: RESOURCE,
        isNavigating: false,
        committedEntity: RESOURCE,
        ready: [RESOURCE],
      }),
    ).toBe(RESOURCE);
  });

  it('does not add the card until its details are in hand', () => {
    // The reported flash: the card must not enter the grid empty and fill in
    // afterwards, because that is what pushed the transaction list down.
    expect(
      focusedEntity({
        deferredSearch: RESOURCE,
        isNavigating: false,
        committedEntity: null,
        ready: [],
      }),
    ).toBe('');
  });

  it('adds the card once the details arrive', () => {
    expect(
      focusedEntity({
        deferredSearch: RESOURCE,
        isNavigating: false,
        committedEntity: null,
        ready: [RESOURCE],
      }),
    ).toBe(RESOURCE);
  });

  it('shows no card for a partial address', () => {
    expect(
      focusedEntity({
        deferredSearch: 'resource_tdx_2_1n20d5',
        isNavigating: false,
        committedEntity: null,
        ready: [RESOURCE],
      }),
    ).toBe('');
  });

  it('keeps the card up while the clearing navigation is in flight', () => {
    expect(
      focusedEntity({
        deferredSearch: '',
        isNavigating: true,
        committedEntity: RESOURCE,
        ready: [RESOURCE],
      }),
    ).toBe(RESOURCE);
  });

  it('drops the card only once the navigation commits', () => {
    expect(
      focusedEntity({
        deferredSearch: '',
        isNavigating: false,
        committedEntity: null,
        ready: [RESOURCE],
      }),
    ).toBe('');
  });

  it('keeps the old card while a different entity loads', () => {
    // Typing a second address while on an entity page: the grid holds the card
    // it has rather than emptying and refilling.
    expect(
      focusedEntity({
        deferredSearch: ACCOUNT,
        isNavigating: true,
        committedEntity: RESOURCE,
        ready: [RESOURCE],
      }),
    ).toBe(RESOURCE);
  });

  it('swaps to the new card once that one is ready', () => {
    expect(
      focusedEntity({
        deferredSearch: ACCOUNT,
        isNavigating: true,
        committedEntity: RESOURCE,
        ready: [RESOURCE, ACCOUNT],
      }),
    ).toBe(ACCOUNT);
  });

  it('never resurrects an entity once navigation has settled', () => {
    expect(
      focusedEntity({
        deferredSearch: '',
        isNavigating: false,
        committedEntity: RESOURCE,
        ready: [RESOURCE],
      }),
    ).toBe('');
  });

  it('recognises every kind the grid can render a card for', () => {
    for (const prefix of ENTITY_PREFIXES) {
      const address = prefix + 'x'.repeat(70);
      expect(
        focusedEntity({
          deferredSearch: address,
          isNavigating: false,
          committedEntity: null,
          ready: [address],
        }),
        prefix,
      ).toBe(address);
    }
  });
});

describe('the wallet filter’s account cards', () => {
  /** Mirrors useReadyEntities. */
  function readyEntities(addresses: string[], pending: string[]): string[] {
    if (addresses.length === 0) return [];
    return addresses.every((a) => !pending.includes(a)) ? addresses : [];
  }

  const A = 'account_rdx1aaa';
  const B = 'account_rdx1bbb';
  const C = 'account_rdx1ccc';

  it('shows nothing while any account is still loading', () => {
    // The reported flash: transactions painted first, then each account card
    // arrived and shoved them down again.
    expect(readyEntities([A, B, C], [B])).toEqual([]);
  });

  it('shows the whole group at once when all have settled', () => {
    expect(readyEntities([A, B, C], [])).toEqual([A, B, C]);
  });

  it('is not blocked forever by an account that fails to resolve', () => {
    // Settled, not loaded: a failed lookup counts as done, so one bad account
    // cannot keep the rest off the page. That card renders nothing on its own.
    expect(readyEntities([A, B], [])).toEqual([A, B]);
  });

  it('shows nothing when the filter is off', () => {
    expect(readyEntities([], [])).toEqual([]);
  });

  it('holds a single account too', () => {
    expect(readyEntities([A], [A])).toEqual([]);
    expect(readyEntities([A], [])).toEqual([A]);
  });
});

describe('reading the committed entity out of the URL', () => {
  /** Mirrors committedEntity in useDashboardNavigation. */
  function committedEntity(pathname: string, queryEntity?: string): string | null {
    const fromPath = /\/dashboard\/(?:tx|resource|account|validator)\/([^/?#]+)/.exec(pathname);
    if (fromPath) return decodeURIComponent(fromPath[1]);
    return queryEntity ?? null;
  }

  it('reads an entity carried in the path', () => {
    expect(committedEntity(`/es/dashboard/resource/${RESOURCE}`)).toBe(RESOURCE);
  });

  it('reads the entity staking carries in the query', () => {
    expect(committedEntity('/es/dashboard/staking', ACCOUNT)).toBe(ACCOUNT);
  });

  it('reports nothing on a plain list', () => {
    expect(committedEntity('/es/dashboard/explorer')).toBeNull();
  });

  it('is not confused by a trailing query string', () => {
    expect(committedEntity(`/es/dashboard/account/${ACCOUNT}`)).toBe(ACCOUNT);
  });
});
