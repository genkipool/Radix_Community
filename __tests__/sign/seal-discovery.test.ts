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

const {
  findSealAndCollection,
  findSignCollections,
  findUserSeals,
  pickSealForCollection,
} = await import('@/features/sign/services/sealDiscovery');
const { SIGN_COLLECTION_MARKER_KEY, SIGN_COLLECTION_MARKER_VALUE, RADIX_SEAL_STANDARD_KEY } =
  await import('@/features/sign/constants/seal');

const NETWORK_ID = 2;
const ACCOUNT = 'account_tdx_2_1user';

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
      heldResources: ['resource_tdx_2_1newer', 'resource_tdx_2_1older'],
      details: {
        // The duplicate sorts first alphabetically and would win on listing order.
        resource_tdx_2_1newer: collection('resource_tdx_2_1newer', 0),
        resource_tdx_2_1older: collection('resource_tdx_2_1older', 9),
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
      heldResources: ['resource_tdx_2_1b', 'resource_tdx_2_1a'],
      details: {
        resource_tdx_2_1b: collection('resource_tdx_2_1b', 3),
        resource_tdx_2_1a: collection('resource_tdx_2_1a', 3),
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

describe('seal selection', () => {
  it('lists every seal the account holds', async () => {
    mockGateway({ sealIds: ['{aaaa}', '{bbbb}'] });
    const seals = await findUserSeals(NETWORK_ID, ACCOUNT);
    expect(seals.map((s) => s.localId)).toEqual(['{aaaa}', '{bbbb}']);
    expect(seals[0].globalId).toBe(`${SEAL_RESOURCE}:{aaaa}`);
  });

  it('picks the seal the collection owner rule names, not the first held', async () => {
    mockGateway({
      details: { 'resource_tdx_2_1coll': collection('resource_tdx_2_1coll', 4, '{bbbb}') },
    });
    const seals = [
      { globalId: `${SEAL_RESOURCE}:{aaaa}`, localId: '{aaaa}' },
      { globalId: `${SEAL_RESOURCE}:{bbbb}`, localId: '{bbbb}' },
    ];
    const picked = await pickSealForCollection(NETWORK_ID, seals, 'resource_tdx_2_1coll');
    expect(picked?.localId).toBe('{bbbb}');
  });

  it('costs no extra lookup when there is only one seal', async () => {
    const seals = [{ globalId: `${SEAL_RESOURCE}:{aaaa}`, localId: '{aaaa}' }];
    const picked = await pickSealForCollection(NETWORK_ID, seals, 'resource_tdx_2_1coll');
    expect(picked?.localId).toBe('{aaaa}');
    expect(gatewayPost).not.toHaveBeenCalled();
  });

  it('falls back to the first seal when the owner rule cannot be read', async () => {
    mockGateway({
      details: { 'resource_tdx_2_1coll': collection('resource_tdx_2_1coll', 4) },
    });
    const seals = [
      { globalId: `${SEAL_RESOURCE}:{aaaa}`, localId: '{aaaa}' },
      { globalId: `${SEAL_RESOURCE}:{bbbb}`, localId: '{bbbb}' },
    ];
    const picked = await pickSealForCollection(NETWORK_ID, seals, 'resource_tdx_2_1coll');
    expect(picked?.localId).toBe('{aaaa}');
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
      // Nothing held: the ledger scan returns no resources at all.
      heldResources: [],
      details: {
        resource_tdx_2_1fresh: collection('resource_tdx_2_1fresh', 0),
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
