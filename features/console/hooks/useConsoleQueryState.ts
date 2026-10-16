'use client';

import { useState } from 'react';

import { useMounted } from '@/hooks/useMounted';

/**
 * State that starts from the tool URL's query (`?pool=…`, `?account=…`).
 *
 * The server has no URL query to read, so during hydration this returns
 * `empty`, exactly what the server drew, and right after it the value the URL
 * asked for. Reading the URL straight in a `useState` initializer would draw
 * something else on the first client render and break hydration. A value set
 * later wins over both.
 */
export function useConsoleQueryState<T>(read: () => T, empty: T): [T, (next: T | ((prev: T) => T)) => void] {
  const mounted = useMounted();
  const [fromUrl] = useState(read);
  const [set, setValue] = useState<{ value: T } | null>(null);
  // Updates only happen after hydration, so until the first one the value is the URL's.
  const update = (next: T | ((prev: T) => T)) =>
    setValue((prev) => ({
      value: typeof next === 'function' ? (next as (prev: T) => T)(prev ? prev.value : fromUrl) : next,
    }));
  return [set ? set.value : mounted ? fromUrl : empty, update];
}
