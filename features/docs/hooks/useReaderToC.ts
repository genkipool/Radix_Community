import { useState, useEffect, useRef } from 'react';
import type { ReaderToCEntry } from '../types/data.types';

export function useReaderToC(toc: ReaderToCEntry[], docId: string) {
  const [activeId, setActiveId] = useState<string>(toc[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Serialize toc ids to a stable string
  const tocKey = toc.map(e => e.id).join(',');

  // Reset activeId when toc changes (render-time prop comparison)
  const [prevTocKey, setPrevTocKey] = useState(tocKey);
  if (tocKey !== prevTocKey) {
    setPrevTocKey(tocKey);
    setActiveId(toc[0]?.id ?? '');
  }

  useEffect(() => {
    if (toc.length === 0) return;

    const visibleSections = new Map<string, number>();
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        if (visibleSections.size > 0) {
          const topmost = Array.from(visibleSections.entries())
            .reduce((min, entry) => entry[1] < min[1] ? entry : min)[0];
          setActiveId(topmost);
        }
      },
      {
        rootMargin: '-80px 0px -55% 0px',
        threshold: 0,
      }
    );

    const timer = setTimeout(() => {
      toc.forEach(entry => {
        const el = document.getElementById(entry.id);
        if (el) observerRef.current?.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [docId, tocKey, toc]);

  return { activeId, setActiveId };
}
