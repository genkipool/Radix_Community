// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACC = 'rdx1qspsu587lvtmf348xul3ycgv0hya55lhkes0my0frtu9jdwe6cv9cas82pnv3';
const BAB = 'account_rdx16x840l7ggv02dr4lkmz4f26czq2t4zekvhdcld0wzq2fefn7842fnq';
const VAL = 'rv1qtu7r2f82qmzphsgw5mug3vzxenzfwrhpyf9rja5ckp2k06ca5duu63guaa';
const BABVAL = 'validator_rdx1sd5368vqdmjk0y2w7ymdts02cz9c52858gpyny56xdvzuheepdeyy0';
const KEY = '02'.padEnd(66, 'a');

const ref = { id: 7n, address: ACC, babylonAddress: BAB, publicKey: KEY, firstSeenStateVersion: 1 };
const svc = vi.hoisted(() => ({
  findAccountByOlympia: vi.fn(),
  findAccountByBabylon: vi.fn(),
  findRriByBabylon: vi.fn(),
  findValidatorByPublicKey: vi.fn(),
  getAccountSummary: vi.fn(),
  getAccountTxPage: vi.fn(),
  getAccountRewards: vi.fn(),
  getResource: vi.fn(),
  getTransactionById: vi.fn(),
  getValidator: vi.fn(),
  getValidatorDelegators: vi.fn(),
  getValidatorRewards: vi.fn(),
  readOlympiaFunds: vi.fn(),
  getTransactionsByDate: vi.fn(),
  validatorCatalog: vi.fn(),
  getValidatorsCached: vi.fn(),
}));
vi.mock('@/services/olympia', () => svc);
vi.mock('@/services/olympia/byDate', () => ({ getTransactionsByDate: svc.getTransactionsByDate }));
vi.mock('@/services/olympia/catalog', () => ({ validatorCatalog: svc.validatorCatalog }));
vi.mock('@/services/olympia/validators', () => ({ proposalsOf: (a: string) => (a === VAL ? { completed: 99, missed: 1, uptimePercent: 99 } : null) }));
vi.mock('@/services/gateway/validators', () => ({ getValidatorsCached: svc.getValidatorsCached }));

import { getMcpRegistry } from '@/services/mcp/tools';

const registry = getMcpRegistry();
const call = (name: string, args: Record<string, unknown>) => registry.call(name, args, { origin: 'https://example.test' });

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  svc.findAccountByOlympia.mockResolvedValue(ref);
  svc.findAccountByBabylon.mockResolvedValue(ref);
});

describe('Olympia archive MCP tools', () => {
  it('lists every Olympia tool', () => {
    const names = registry.list().map((t) => t.name).filter((n) => n.startsWith('olympia_'));
    expect(names).toHaveLength(13);
  });

  it('olympia_from_babylon finds the Olympia account of any migrated Babylon account', async () => {
    const res = await call('olympia_from_babylon', { babylonAddress: BAB });
    expect(res.structuredContent).toMatchObject({ found: true, kind: 'account', olympiaAddress: ACC, publicKey: KEY });
  });

  it('olympia_from_babylon matches a Babylon validator by its node key', async () => {
    svc.getValidatorsCached.mockResolvedValue({ validators: [{ address: BABVAL, publicKey: KEY.toUpperCase() }] });
    svc.findValidatorByPublicKey.mockResolvedValue({ address: VAL, name: 'Node' });
    const res = await call('olympia_from_babylon', { babylonAddress: BABVAL });
    expect(res.structuredContent).toMatchObject({ found: true, kind: 'validator', olympiaAddress: VAL, matchedBy: 'node public key' });
  });

  it('olympia_from_babylon answers found: false, not an error, for an address with no Olympia past', async () => {
    svc.findAccountByBabylon.mockResolvedValue(null);
    const res = await call('olympia_from_babylon', { babylonAddress: BAB });
    expect(res.isError).toBeUndefined();
    expect(res.structuredContent).toMatchObject({ found: false });
  });

  it('olympia_lookup routes a transaction id to the transaction', async () => {
    svc.getTransactionById.mockResolvedValue({
      transactionId: 'ab'.repeat(32), stateVersion: 1, timestamp: '2022-01-01T00:00:00Z', epoch: 1, round: 2, feeXrd: 0.1, feePayer: ACC,
      message: null, messageEncrypted: false, actions: [], balanceChanges: [], allBalanceChanges: [], accountsCount: 1, rawHex: 'ff',
    });
    const res = await call('olympia_lookup', { value: 'ab'.repeat(32) });
    expect(res.structuredContent).toMatchObject({ transactionId: 'ab'.repeat(32), status: 'CommittedSuccess' });
    expect(res.structuredContent).not.toHaveProperty('rawHex');
  });

  it('olympia_lookup refuses what is not an Olympia identifier', async () => {
    const res = await call('olympia_lookup', { value: 'not an address' });
    expect(res.isError).toBe(true);
  });

  it('olympia_get_account says so when the account did not exist on Olympia', async () => {
    svc.findAccountByOlympia.mockResolvedValue(null);
    const res = await call('olympia_get_account', { address: ACC });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain('did not exist on Olympia');
  });

  it('olympia_list_transactions_by_date reads whole UTC days and rejects an inverted range', async () => {
    svc.getTransactionsByDate.mockResolvedValue({ items: [] });
    await call('olympia_list_transactions_by_date', { from: '2022-05-10' });
    expect(svc.getTransactionsByDate).toHaveBeenCalledWith(Date.parse('2022-05-10T00:00:00Z'), Date.parse('2022-05-10T23:59:59.999Z'), null, 20);
    const bad = await call('olympia_list_transactions_by_date', { from: '2022-05-11', to: '2022-05-10' });
    expect(bad.isError).toBe(true);
  });

  it('olympia_list_validators ranks by stake with share and uptime, and filters by name', async () => {
    svc.validatorCatalog.mockResolvedValue(new Map([
      ['rv1qsmall', { address: 'rv1qsmall', name: 'Small', totalXrdStaked: 25, publicKey: null }],
      [VAL, { address: VAL, name: 'Big Node', totalXrdStaked: 75, publicKey: KEY }],
    ]));
    const all = await call('olympia_list_validators', {});
    const rows = (all.structuredContent as { validators: { address: string; sharePercent: number; uptimePercent: number | null }[] }).validators;
    expect(rows.map((r) => r.address)).toEqual([VAL, 'rv1qsmall']);
    expect(rows[0]).toMatchObject({ sharePercent: 75, uptimePercent: 99 });
    const some = await call('olympia_list_validators', { search: 'small' });
    expect((some.structuredContent as { validators: unknown[] }).validators).toHaveLength(1);
  });

  it('olympia_get_validator_delegators pages with an offset', async () => {
    svc.getValidatorDelegators.mockResolvedValue({ items: [{ address: ACC, stakedXrd: 5 }], total: 3 });
    const res = await call('olympia_get_validator_delegators', { address: VAL, offset: 1, limit: 1 });
    expect(svc.getValidatorDelegators).toHaveBeenCalledWith(VAL, 1, 1);
    expect(res.content[0].text).toContain('offset=2');
  });

  it('olympia_get_token accepts the Babylon resource it was migrated to', async () => {
    svc.findRriByBabylon.mockResolvedValue('xrd_rr1qy5wfsfh');
    svc.getResource.mockResolvedValue({ rri: 'xrd_rr1qy5wfsfh', symbol: 'XRD', name: 'Radix', topHolders: [], totalSupply: '1', totalMinted: '1', totalBurnt: '0', holders: 1, createdStateVersion: 1 });
    const res = await call('olympia_get_token', { token: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', holders: 0 });
    expect(svc.getResource).toHaveBeenCalledWith('xrd_rr1qy5wfsfh', 0);
    expect(res.structuredContent).toMatchObject({ rri: 'xrd_rr1qy5wfsfh' });
  });
});
