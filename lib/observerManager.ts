/**
 * Shared IntersectionObserver manager (singleton).
 *
 * Instead of each ScrollReveal creating its own IntersectionObserver,
 * all elements share a single one. On a typical homepage with ~15+
 * scroll-reveal sections this reduces ~15 observers → 1, cutting
 * observer-related main-thread work (~80-150 ms according to Lighthouse).
 *
 * Usage:
 *   observe(element, callback, options)   → starts observing
 *   unobserve(element)                    → stops observing
 */

type ObserverCallback = (entry: IntersectionObserverEntry) => void;

interface ObserverConfig {
  threshold: number;
  rootMargin: string;
}

/** Key for grouping elements that share the same observer options */
function configKey({ threshold, rootMargin }: ObserverConfig): string {
  return `${threshold}|${rootMargin}`;
}

const observers = new Map<string, IntersectionObserver>();
const callbacks = new Map<Element, ObserverCallback>();

function getOrCreateObserver(config: ObserverConfig): IntersectionObserver {
  const key = configKey(config);
  const existing = observers.get(key);
  if (existing) return existing;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const cb = callbacks.get(entry.target);
        if (cb) cb(entry);
      }
    },
    { threshold: config.threshold, rootMargin: config.rootMargin },
  );

  observers.set(key, observer);
  return observer;
}

export function observe(
  element: Element,
  callback: ObserverCallback,
  config: ObserverConfig = { threshold: 0.1, rootMargin: '-40px 0px 0px 0px' },
): void {
  callbacks.set(element, callback);
  const observer = getOrCreateObserver(config);
  observer.observe(element);
}

export function unobserve(element: Element): void {
  callbacks.delete(element);

  // Remove from every observer it might belong to
  for (const observer of observers.values()) {
    observer.unobserve(element);
  }
}
