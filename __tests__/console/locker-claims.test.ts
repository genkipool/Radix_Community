import { describe, expect, it } from 'vitest';

import { fetchLockerClaims } from '@/features/console/lib/locker-lookup';

const gatewayError = (status: number, message: string) => Object.assign(new Error(message), { status });

describe('fetchLockerClaims', () => {
  it('reads "Account locker not found" as nothing waiting', async () => {
    const post = async <T,>(): Promise<T> => {
      throw gatewayError(404, 'Account locker not found');
    };
    await expect(fetchLockerClaims(post, 'locker_x', 'account_x')).resolves.toEqual([]);
  });

  it('still fails on any other error', async () => {
    const post = async <T,>(): Promise<T> => {
      throw gatewayError(500, 'Gateway 500');
    };
    await expect(fetchLockerClaims(post, 'locker_x', 'account_x')).rejects.toThrow('Gateway 500');
  });

  it('lists fungible claims and skips empty vaults', async () => {
    const post = async <T,>(): Promise<T> =>
      ({
        items: [
          { type: 'Fungible', resource_address: 'resource_a', amount: '5' },
          { type: 'Fungible', resource_address: 'resource_b', amount: '0' },
        ],
      }) as T;
    await expect(fetchLockerClaims(post, 'locker_x', 'account_x')).resolves.toEqual([{ resource: 'resource_a', amount: '5' }]);
  });
});
