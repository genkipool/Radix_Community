/**
 * The last answer of a per-account query, kept in the browser so a picker can
 * show its tabs and rows at once on the next visit.
 *
 * The copy is only a placeholder: it is handed to React Query as initial data
 * dated at 0, so the query counts it as stale and fetches the live answer as
 * soon as it is enabled, replacing the copy when it arrives. Nothing is ever
 * served from the copy without that refresh.
 */

const PREFIX = 'console-copy:';

const storageKey = (queryKey: readonly unknown[]) => PREFIX + JSON.stringify(queryKey);

/** The stored copy for a query key, or undefined when there is none or storage is unavailable. */
export function readBrowserCopy<T>(queryKey: readonly unknown[]): T | undefined {
  try {
    const raw = window.localStorage.getItem(storageKey(queryKey));
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

/** Store the latest answer for a query key; a full or blocked storage is ignored. */
export function writeBrowserCopy(queryKey: readonly unknown[], value: unknown) {
  try {
    window.localStorage.setItem(storageKey(queryKey), JSON.stringify(value));
  } catch {
    // Nothing to do: the next visit simply loads from the network.
  }
}

/**
 * useQuery options that show the stored copy at once and refetch immediately.
 * `initialDataUpdatedAt: 0` marks the copy stale, so it is always replaced.
 */
export function browserCopyOptions<T>(queryKey: readonly unknown[]) {
  return {
    initialData: () => (typeof window === 'undefined' ? undefined : readBrowserCopy<T>(queryKey)),
    initialDataUpdatedAt: 0,
  };
}
