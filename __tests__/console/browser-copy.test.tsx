// @vitest-environment jsdom
/**
 * The browser copy of a per-account query shows at once and is always
 * replaced by a live fetch, never served on its own.
 */
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { browserCopyOptions, readBrowserCopy, writeBrowserCopy } from '@/features/console/lib/browser-copy';

const KEY = ['console-test', 'mainnet', 'account_a'];

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

/** jsdom serves an opaque origin here, where real localStorage throws. */
const memory = new Map<string, string>();
const memoryStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;
Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true });

beforeEach(() => {
  memory.clear();
});

describe('browser copy', () => {
  it('reads back what was written, per query key', () => {
    writeBrowserCopy(KEY, ['old']);
    expect(readBrowserCopy(KEY)).toEqual(['old']);
    expect(readBrowserCopy(['console-test', 'stokenet', 'account_a'])).toBeUndefined();
  });

  it('shows the copy at once and replaces it with the live answer, even with a long staleTime', async () => {
    writeBrowserCopy(KEY, ['old']);
    const queryFn = vi.fn(async () => ['live']);
    const { result } = renderHook(
      () => useQuery({ queryKey: KEY, ...browserCopyOptions<string[]>(KEY), staleTime: 30 * 60_000, queryFn }),
      { wrapper },
    );
    expect(result.current.data).toEqual(['old']);
    await waitFor(() => expect(result.current.data).toEqual(['live']));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('ignores a storage that throws', () => {
    const spy = vi.spyOn(memoryStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeBrowserCopy(KEY, ['x'])).not.toThrow();
    spy.mockRestore();
  });
});
