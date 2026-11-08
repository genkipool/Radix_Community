import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/olympia', () => ({
  getAccountSummary: vi.fn(async () => ({ address: 'rdx1x' })),
  getAccountStateAt: vi.fn(async (_ref: unknown, sv: number, day: string | null) => ({ address: 'rdx1x', stateVersion: sv, day })),
  getTransactionById: vi.fn(async () => null),
  getAccountTxPage: vi.fn(async () => ({ items: [] })),
  findLinkByBabylon: vi.fn(async () => null),
}));
vi.mock('@/services/olympia/accounts', () => ({
  findAccountByOlympia: vi.fn(async () => ({ id: 1n, address: 'rdx1x', babylonAddress: 'account_rdx1y', publicKey: '', firstSeenStateVersion: 1 })),
  findAccountByBabylon: vi.fn(async () => { throw new Error('dataset down'); }),
}));

const req = (path: string) => new NextRequest(new URL(`http://localhost${path}`));
const ACCOUNT = 'rdx1qspxhhwwhfqpzprvkfgz6ytkdxvqcy6e65nmdv0cdvs8dar2szenq3gruxhkv';

describe('/api/olympia routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects malformed input with 400', async () => {
    const { GET } = await import('@/app/api/olympia/account/route');
    expect((await GET(req('/api/olympia/account?address=hello'))).status).toBe(400);
    const tx = await import('@/app/api/olympia/tx/route');
    expect((await tx.GET(req('/api/olympia/tx?id=1234'))).status).toBe(400);
    const page = await import('@/app/api/olympia/account/transactions/route');
    expect((await page.GET(req(`/api/olympia/account/transactions?address=${ACCOUNT}&limit=500`))).status).toBe(400);
  });

  it('reads an account at a state version or at the end of a day of Olympia, and nothing else', async () => {
    const { GET } = await import('@/app/api/olympia/account/at/route');
    for (const at of ['', 'yesterday', '0', '337759840', '2021-07-25', '2023-09-29', '2022-13-01']) {
      expect((await GET(req(`/api/olympia/account/at?address=${ACCOUNT}&at=${at}`))).status).toBe(400);
    }
    const byVersion = await GET(req(`/api/olympia/account/at?address=${ACCOUNT}&at=200000000`));
    expect(await byVersion.json()).toMatchObject({ stateVersion: 200000000, day: null });
    const byDay = await GET(req(`/api/olympia/account/at?address=${ACCOUNT}&at=2023-09-28`));
    expect(await byDay.json()).toMatchObject({ stateVersion: 337759839, day: '2023-09-28' });
    expect(byDay.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  it('answers with long caching when found', async () => {
    const { GET } = await import('@/app/api/olympia/account/route');
    const res = await GET(req(`/api/olympia/account?address=${ACCOUNT}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  it('says 404 for what Olympia never had', async () => {
    const { GET } = await import('@/app/api/olympia/tx/route');
    expect((await GET(req(`/api/olympia/tx?id=${'0'.repeat(64)}`))).status).toBe(404);
  });

  it('turns an unreachable dataset into a retryable 503, never a 404', async () => {
    const { GET } = await import('@/app/api/olympia/account/route');
    const res = await GET(req('/api/olympia/account?address=account_rdx168u7hevd7s30a3hj8cu6qvp4ffehm5f3xvzet3gspdsdc2cq7y6tjq'));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
  });
});
