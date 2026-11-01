// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A real mainnet withdrawal (txid_rdx190yvv6rj0247f4e0zj0rechlqtjzmc529smjxnvfyg4dt7m0mths7ddnjc),
// signed by the secp256k1 key of LEGACY_ACCOUNT: the Gateway is the only thing mocked.
const RAW_TX =
  '4d22030221022104210707010abd620500000000000ac7620500000000000966f2a5d5220101200720220ac527621fc316c63faa921a49c87aa0f66e7ffb6435c6e78a009371bd0d31010008000020220441038000d109b298c4b1f9c521cc68fe3653494fb5d13f9ab5e9c67b30f6fc4a53b30c086c6f636b5f66656521018540d2bc5649fa4a050000000000000000000000000000000041038000d109b298c4b1f9c521cc68fe3653494fb5d13f9ab5e9c67b30f6fc4a53b30c087769746864726177210280005d1af0e84ec3078fd4cc9699d9ec72c2b14d650cfd6ce00a0c04597185d285c02e91f02d4ca123dcb40000000000000000000000000000000280005d1af0e84ec3078fd4cc9699d9ec72c2b14d650cfd6ce00a0c04597185d285c02e91f02d4ca123dcb4000000000000000000000000000041038000d17d5306c056c691d05b9507726c5922d6cf2e9131f90a835ab5a55845880c147472795f6465706f7369745f6f725f61626f7274210281000000002200002020002200002022010001210120074100e8c673130f1fac963341d734dad610385ebce0bae93e4f103a66a02fc4405af713042f1a9cd6dcaadf24f9771b8f22453c148b2db6337fc91958fc0aab067fd922010121012007408baf1d49efa774d882e84348636e6298f1ec781d5d54b4560763fbd17d4592d8d555fa81eb88b1ffcdcc42fa7785c2e1f34088f6949cfce519d145196c844001';
const LEGACY_ACCOUNT = 'account_rdx16yym9xxyk8uu2gwvdrlrv56ff76az0u6kh5uv7es7m7y55an25yxfk';
const OLYMPIA_ADDRESS = 'rdx1qsp5h96493xgx5rlcu2p3pajcr7h25nh77s90qzrjgvtfk37ryvp6fcsjasvg';
const PUBLIC_KEY = '034b97552c4c83507fc7141887b2c0fd755277f7a05780439218b4da3e19181d27';
// A valid account address whose key did not sign RAW_TX.
const OTHER_ACCOUNT = 'account_rdx16ymsynhk8xerl8jp8pz9ddla02tly4a4csxy0j2aawq6yzcq9qxl2f';

const streamTransactions = vi.fn();
vi.mock('@/services/gateway/client', () => ({
  getGateway: () => ({ stream: { innerClient: { streamTransactions } } }),
  withRetry: (fn: () => unknown) => fn(),
}));

import { getMcpRegistry } from '@/services/mcp/tools';

const registry = getMcpRegistry();
const call = (args: Record<string, unknown>) =>
  registry.call('find_olympia_address', args, { origin: 'https://example.test' });

beforeEach(() => {
  streamTransactions.mockReset();
  streamTransactions.mockResolvedValue({ items: [{ raw_hex: RAW_TX }] });
});

describe('find_olympia_address', () => {
  it('recovers the Olympia address from the account’s own signature', async () => {
    const res = await call({ babylonAddress: LEGACY_ACCOUNT, network: 'mainnet' });
    expect(res.isError).toBeUndefined();
    expect(res.structuredContent).toEqual({
      found: true,
      babylonAddress: LEGACY_ACCOUNT,
      network: 'mainnet',
      olympiaAddress: OLYMPIA_ADDRESS,
      publicKeyHex: PUBLIC_KEY,
    });
    expect(res.content[0].text).toContain(OLYMPIA_ADDRESS);
    expect(res.content[0].text).toContain('convert_olympia_address');
    expect(streamTransactions).toHaveBeenCalledWith({
      streamTransactionsRequest: expect.objectContaining({ manifest_accounts_withdrawn_from_filter: [LEGACY_ACCOUNT] }),
    });
  });

  it('answers found: false, not an error, when the account never signed', async () => {
    streamTransactions.mockResolvedValue({ items: [] });
    const res = await call({ babylonAddress: LEGACY_ACCOUNT, network: 'mainnet' });
    expect(res.isError).toBeUndefined();
    expect(res.structuredContent).toEqual({
      found: false,
      babylonAddress: LEGACY_ACCOUNT,
      network: 'mainnet',
      reason: 'no-transactions',
    });
    expect(res.content[0].text).toContain('never withdrawn');
  });

  it('answers not-found when no recovered key derives the address', async () => {
    const res = await call({ babylonAddress: OTHER_ACCOUNT, network: 'mainnet' });
    expect(res.isError).toBeUndefined();
    expect(res.structuredContent).toMatchObject({ found: false, reason: 'not-found' });
  });

  it('is an error for an address the Gateway rejects', async () => {
    streamTransactions.mockRejectedValue(new Error('InvalidRequestError: bad address'));
    const res = await call({ babylonAddress: 'account_tdx_2_1notreal000000', network: 'mainnet' });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('Not a valid mainnet account address');
  });

  it('is an error when the Gateway fails', async () => {
    streamTransactions.mockRejectedValue(new Error('Gateway 503'));
    const res = await call({ babylonAddress: LEGACY_ACCOUNT, network: 'mainnet' });
    expect(res.isError).toBe(true);
  });

  it('rejects what is not an account address before calling the Gateway', async () => {
    const res = await call({ babylonAddress: 'rdx1qsp5h96493xgx5rlcu2p3pajcr7h25nh77s90qzrjgvtfk37ryvp6fcsjasvg', network: 'mainnet' });
    expect(res.isError).toBe(true);
    expect(streamTransactions).not.toHaveBeenCalled();
  });
});
