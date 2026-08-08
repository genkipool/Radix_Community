// @vitest-environment jsdom
/**
 * Which seal, and which signing collection?
 *
 * An account can end up holding more than one of either: the brand is
 * open-mint, and a collection can be created twice (two tabs, by hand, or
 * because a discovery miss re-offered the onboarding). Picking "whichever the
 * Gateway listed first" made the answer arbitrary — it could walk away from the
 * collection holding the account's history, and it could build a mint proof
 * from a seal that does not command the collection, which the engine refuses.
 *
 * And holding is not owning: an invitation NFT is minted by the ISSUER into the
 * ISSUER's collection and deposited into the signer's account, so it arrives
 * looking exactly like one of the signer's own. Only the locked owner rule says
 * whose it is.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gatewayPost = vi.fn();
vi.mock('@/services/gateway/bases', () => ({
  gatewayPost: (...args: unknown[]) => gatewayPost(...args),
}));

const SEAL_RESOURCE = 'resource_tdx_2_1seal';
vi.mock('@/features/sign/constants/seal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/sign/constants/seal')>();
  return { ...actual, radixSealAddress: () => SEAL_RESOURCE };
});

const { findSealAndCollection, findSignCollections, findUserSeals } = await import(
  '@/features/sign/services/sealDiscovery'
);
const { SIGN_COLLECTION_MARKER_KEY, SIGN_COLLECTION_MARKER_VALUE, RADIX_SEAL_STANDARD_KEY } =
  await import('@/features/sign/constants/seal');

const NETWORK_ID = 2;
const ACCOUNT = 'account_tdx_2_1user';
/** The seal this account holds in most of these tests. */
const OWN_SEAL = '{aaaa}';

/** A signing collection as the Gateway reports it. */
function collection(address: string, supply: number, owner?: string) {
  return {
    address,
    metadata: {
      items: [
        {
          key: SIGN_COLLECTION_MARKER_KEY,
          value: { typed: { value: SIGN_COLLECTION_MARKER_VALUE } },
        },
        { key: RADIX_SEAL_STANDARD_KEY, value: { typed: { value: SEAL_RESOURCE } } },
      ],
    },
    details: {
      total_supply: String(supply),
      ...(owner
        ? {
            role_assignments: {
              owner: {
                rule: {
                  access_rule: {
                    proof_rule: {
                      requirement: {
                        non_fungible: {
                          resource_address: SEAL_RESOURCE,
                          local_id: { simple_rep: owner },
                        },
                      },
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
  };
}

/** Route each Gateway call to the payload the test wants for it. */
function mockGateway(options: {
  heldResources?: string[];
  sealIds?: string[];
  details?: Record<string, ReturnType<typeof collection>>;
}) {
  const { heldResources = [], sealIds = [], details = {} } = options;
  gatewayPost.mockImplementation(async (_net: string, path: string, body: Record<string, unknown>) => {
    if (path === '/state/entity/details') {
      const addresses = body.addresses as string[];
      // The account itself: its non-fungible resources (and seal ids).
      if (addresses.includes(ACCOUNT)) {
        return {
          items: [
            {
              address: ACCOUNT,
              non_fungible_resources: {
                items: [
                  ...(sealIds.length
                    ? [
                        {
                          resource_address: SEAL_RESOURCE,
                          vaults: { items: [{ items: sealIds }] },
                        },
                      ]
                    : []),
                  ...heldResources.map((address) => ({ resource_address: address })),
                ],
              },
            },
          ],
        };
      }
      return { items: addresses.map((a) => details[a]).filter(Boolean) };
    }
    return { items: [] };
  });
}

/** jsdom serves an opaque origin, where real localStorage throws on access. */
const memoryStorage = (() => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
})();
Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  configurable: true,
});

beforeEach(() => {
  gatewayPost.mockReset();
  localStorage.clear();
});

describe('signing collection ranking', () => {
  it('prefers the collection holding the history over an empty duplicate', async () => {
    mockGateway({
      sealIds: [OWN_SEAL],
      heldResources: ['resource_tdx_2_1newer', 'resource_tdx_2_1older'],
      details: {
        // The duplicate sorts first alphabetically and would win on listing order.
        resource_tdx_2_1newer: collection('resource_tdx_2_1newer', 0, OWN_SEAL),
        resource_tdx_2_1older: collection('resource_tdx_2_1older', 9, OWN_SEAL),
      },
    });
    const found = await findSignCollections(NETWORK_ID, ACCOUNT);
    expect(found.map((c) => c.resourceAddress)).toEqual([
      'resource_tdx_2_1older',
      'resource_tdx_2_1newer',
    ]);
    expect(found[0].totalSupply).toBe(9);
  });

  it('breaks ties on the address, so the answer never wobbles', async () => {
    mockGateway({
      sealIds: [OWN_SEAL],
      heldResources: ['resource_tdx_2_1b', 'resource_tdx_2_1a'],
      details: {
        resource_tdx_2_1b: collection('resource_tdx_2_1b', 3, OWN_SEAL),
        resource_tdx_2_1a: collection('resource_tdx_2_1a', 3, OWN_SEAL),
      },
    });
    const first = await findSignCollections(NETWORK_ID, ACCOUNT);
    const second = await findSignCollections(NETWORK_ID, ACCOUNT);
    expect(first[0].resourceAddress).toBe('resource_tdx_2_1a');
    expect(second.map((c) => c.resourceAddress)).toEqual(
      first.map((c) => c.resourceAddress),
    );
  });

  it('ignores resources that are not signing collections', async () => {
    mockGateway({
      sealIds: [OWN_SEAL],
      heldResources: ['resource_tdx_2_1random'],
      details: {
        resource_tdx_2_1random: {
          address: 'resource_tdx_2_1random',
          metadata: { items: [] },
          details: { total_supply: '100' },
        } as ReturnType<typeof collection>,
      },
    });
    expect(await findSignCollections(NETWORK_ID, ACCOUNT)).toEqual([]);
  });
});

/**
 * The bug this guards: an invited co-signer opens the shared link holding the
 * ISSUER's invitation. That collection is a genuine signing collection of the
 * official brand, so every check except ownership passed, and it ranks FIRST
 * (it carries the issuer's whole history, while the signer's own may be empty
 * or not exist yet). The signature was then built against it with a proof of
 * the signer's own seal, and the wallet showed a failed transaction.
 */
describe('held is not owned', () => {
  const ISSUER_COLLECTION = 'resource_tdx_2_1issuer';

  it("never reports the issuer's collection as the signer's own", async () => {
    mockGateway({
      sealIds: [OWN_SEAL],
      // The signer holds the invitation, so the issuer's collection is among
      // the account's non-fungible resources.
      heldResources: [ISSUER_COLLECTION, 'resource_tdx_2_1mine'],
      details: {
        [ISSUER_COLLECTION]: collection(ISSUER_COLLECTION, 40, '{zzzz}'),
        resource_tdx_2_1mine: collection('resource_tdx_2_1mine', 1, OWN_SEAL),
      },
    });
    const found = await findSignCollections(NETWORK_ID, ACCOUNT);
    expect(found.map((c) => c.resourceAddress)).toEqual(['resource_tdx_2_1mine']);

    const { collection: chosen, seal } = await findSealAndCollection(NETWORK_ID, ACCOUNT);
    expect(chosen?.resourceAddress).toBe('resource_tdx_2_1mine');
    expect(seal?.localId).toBe(OWN_SEAL);
  });

  it('reports no collection at all when the signer only holds an invitation', async () => {
    mockGateway({
      sealIds: [OWN_SEAL],
      heldResources: [ISSUER_COLLECTION],
      details: { [ISSUER_COLLECTION]: collection(ISSUER_COLLECTION, 40, '{zzzz}') },
    });
    // Null is what tells the UI to create the collection WITH the first
    // signature bundled — the path that actually works for a first-timer.
    expect((await findSealAndCollection(NETWORK_ID, ACCOUNT)).collection).toBeNull();
  });

  it('drops a collection whose owner rule cannot be read', async () => {
    mockGateway({
      sealIds: [OWN_SEAL],
      heldResources: ['resource_tdx_2_1opaque'],
      details: {
        resource_tdx_2_1opaque: collection('resource_tdx_2_1opaque', 5),
      },
    });
    expect(await findSignCollections(NETWORK_ID, ACCOUNT)).toEqual([]);
  });
});

describe('seal selection', () => {
  it('lists every seal the account holds', async () => {
    mockGateway({ sealIds: ['{aaaa}', '{bbbb}'] });
    const seals = await findUserSeals(NETWORK_ID, ACCOUNT);
    expect(seals.map((s) => s.localId)).toEqual(['{aaaa}', '{bbbb}']);
    expect(seals[0].globalId).toBe(`${SEAL_RESOURCE}:{aaaa}`);
  });

  it('picks the seal the collection owner rule names, not the first held', async () => {
    mockGateway({
      sealIds: ['{aaaa}', '{bbbb}'],
      heldResources: ['resource_tdx_2_1coll'],
      details: { resource_tdx_2_1coll: collection('resource_tdx_2_1coll', 4, '{bbbb}') },
    });
    const { seal } = await findSealAndCollection(NETWORK_ID, ACCOUNT);
    expect(seal?.localId).toBe('{bbbb}');
  });

  it('still answers with a seal when the account owns no collection yet', async () => {
    mockGateway({ sealIds: ['{aaaa}', '{bbbb}'] });
    const { seal, collection: chosen } = await findSealAndCollection(NETWORK_ID, ACCOUNT);
    expect(seal?.localId).toBe('{aaaa}');
    expect(chosen).toBeNull();
  });
});

describe('the pair used by every mint', () => {
  it('resolves the busiest collection and the seal that commands it', async () => {
    mockGateway({
      sealIds: ['{aaaa}', '{bbbb}'],
      heldResources: ['resource_tdx_2_1empty', 'resource_tdx_2_1busy'],
      details: {
        resource_tdx_2_1empty: collection('resource_tdx_2_1empty', 0, '{aaaa}'),
        resource_tdx_2_1busy: collection('resource_tdx_2_1busy', 12, '{bbbb}'),
      },
    });
    // Both are this account's own: two seals, one collection each.
    const { seal, collection: chosen } = await findSealAndCollection(NETWORK_ID, ACCOUNT);
    expect(chosen?.resourceAddress).toBe('resource_tdx_2_1busy');
    expect(seal?.localId).toBe('{bbbb}');
  });
});

/**
 * A collection created a moment ago holds no NFT at all: its seal owns it, but
 * nothing of it sits in a vault, so scanning the account's holdings cannot see
 * it. That is why it never showed up in the list after being created.
 */
describe('collections with nothing minted yet', () => {
  it('finds one the account created even though it holds none of it', async () => {
    const { rememberSignCollection } = await import(
      '@/features/sign/services/sealDiscovery'
    );
    mockGateway({
      sealIds: [OWN_SEAL],
      // Nothing held: the ledger scan returns no resources at all.
      heldResources: [],
      details: {
        resource_tdx_2_1fresh: collection('resource_tdx_2_1fresh', 0, OWN_SEAL),
      },
    });
    rememberSignCollection(NETWORK_ID, ACCOUNT, 'resource_tdx_2_1fresh');
    const found = await findSignCollections(NETWORK_ID, ACCOUNT);
    expect(found.map((c) => c.resourceAddress)).toEqual(['resource_tdx_2_1fresh']);
  });

  it('drops a remembered address that is not a signing collection', async () => {
    const { rememberSignCollection } = await import(
      '@/features/sign/services/sealDiscovery'
    );
    mockGateway({
      sealIds: [OWN_SEAL],
      heldResources: [],
      details: {
        resource_tdx_2_1bogus: {
          address: 'resource_tdx_2_1bogus',
          metadata: { items: [] },
          details: { total_supply: '3' },
        } as ReturnType<typeof collection>,
      },
    });
    rememberSignCollection(NETWORK_ID, ACCOUNT, 'resource_tdx_2_1bogus');
    expect(await findSignCollections(NETWORK_ID, ACCOUNT)).toEqual([]);
  });
});
