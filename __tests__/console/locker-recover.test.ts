import { describe, expect, it } from 'vitest';

import { recoverAllBatches, recoverAllManifest } from '@/features/console/lib/locker-manifests';

const claims = (n: number) => Array.from({ length: n }, (_, i) => ({ resource: `resource_${i}`, amount: '1' }));

describe('recovering everything unclaimed', () => {
  it('splits the recover calls into transactions of a given size, keeping each claimant together', () => {
    const batches = recoverAllBatches(
      [
        { claimant: 'a', claims: claims(3) },
        { claimant: 'b', claims: claims(2) },
      ],
      2,
    );
    expect(batches.map((b) => b.map((i) => [i.claimant, i.claims.length]))).toEqual([
      [['a', 2]],
      [['a', 1], ['b', 1]],
      [['b', 1]],
    ]);
  });

  it('builds nothing when nothing is stored', () => {
    expect(recoverAllManifest({ account: 'acc', locker: 'lk', badge: { account: 'acc', resource: 'badge' }, items: [] })).toBe('');
    expect(recoverAllBatches([{ claimant: 'a', claims: [] }])).toEqual([]);
  });
});
