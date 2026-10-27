// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decodeAddressNodeId, encodeAddress } from '@/features/console/lib/address-inspect';
import { findGlobalCaller, globalCallerId, matchGlobalCaller, packageOfCallerRule } from '@/features/console/lib/caller-badge';

const GLOBAL_CALLER = 'resource_rdx1nfxxxxxxxxxxglcllrxxxxxxxxx002350006550xxxxxxxxxglcllr';
const PACKAGE_CALLER = 'resource_rdx1nfxxxxxxxxxxpkcllrxxxxxxxxx003652646977xxxxxxxxxpkcllr';
// A real DefiPlaza pair and the manager rule of its base pool, from mainnet.
const DEFIPLAZA = 'component_rdx1cqvxkaazmpnvg3f9ufc5n2msv6x7ztjdusdm06lhtf5n7wr8guggg5';
const OTHER = 'component_rdx1cqy7sq3mxj2whhlqlryy05hzs96m0ajnv23e7j7vanmdwwlccnmz68';
const POOL = 'pool_rdx1c47jlmd9stptfy2a7e39wnjfechu72q9ggus29x0mqf98m8xt70rx2';
const RULE = {
  type: 'nonFungible' as const,
  resource: GLOBAL_CALLER,
  localId: '[7140414708abca2818ea33ac51ed96816b92907d020b296ab04d7b99d51d8e89]',
};
const POOL_PACKAGE = 'package_rdx1pkgxxxxxxxxxplxxxxxxxxxxxxx020379220524xxxxxxxxxplxxxx';

describe('caller badges', () => {
  it('encodes an address back from its node id', () => {
    for (const address of [DEFIPLAZA, POOL, POOL_PACKAGE, GLOBAL_CALLER]) {
      const hrp = address.slice(0, address.lastIndexOf('1'));
      expect(encodeAddress(hrp, decodeAddressNodeId(address)!)).toBe(address);
    }
  });

  it('hashes a component into the id of its global caller badge', () => {
    expect(globalCallerId(DEFIPLAZA)).toBe(RULE.localId);
    expect(matchGlobalCaller(RULE, [OTHER, DEFIPLAZA])).toBe(DEFIPLAZA);
    expect(matchGlobalCaller(RULE, [OTHER])).toBeNull();
  });

  it('decodes the package of a package caller rule', () => {
    const id = `[${Array.from(decodeAddressNodeId(POOL_PACKAGE)!, (b) => b.toString(16).padStart(2, '0')).join('')}]`;
    expect(packageOfCallerRule({ type: 'nonFungible', resource: PACKAGE_CALLER, localId: id })).toBe(POOL_PACKAGE);
    expect(packageOfCallerRule(RULE)).toBeNull();
  });

  it('finds the component among the entities of the first transaction', async () => {
    const post = async <T,>(path: string, body: Record<string, unknown>) => {
      expect(path).toBe('/stream/transactions');
      expect(body).toMatchObject({ affected_global_entities_filter: [POOL], order: 'Asc', limit_per_page: 1 });
      return { items: [{ affected_global_entities: [GLOBAL_CALLER, OTHER, DEFIPLAZA, POOL] }] } as T;
    };
    expect(await findGlobalCaller(post, POOL, [RULE, { type: 'allowAll' }])).toEqual({ [RULE.localId]: DEFIPLAZA });
    expect(await findGlobalCaller(post, POOL, [{ type: 'allowAll' }])).toEqual({});
  });
});
