import { useEffect, type RefObject } from 'react';

/**
 * Silky-smooth scroll handoff at top/bottom edges of an inner scrollable container.
 * Splits leftover wheel delta across the boundary and applies rAF exponential damping
 * to avoid Chromium wheel-latching snags and hard jumps.
 */
export function useSmoothScrollChaining(scrollContainerRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    let pendingDelta = 0;
    let rafId = 0;

    const stepSmoothScroll = () => {
      if (Math.abs(pendingDelta) < 0.5) {
        pendingDelta = 0;
        rafId = 0;
        return;
      }
      const chunk = pendingDelta * 0.28;
      pendingDelta -= chunk;
      window.scrollBy(0, chunk);
      rafId = requestAnimationFrame(stepSmoothScroll);
    };

    const queueWindowScroll = (amount: number) => {
      pendingDelta += amount;
      if (!rafId) {
        rafId = requestAnimationFrame(stepSmoothScroll);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

      const delta =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * window.innerHeight
            : e.deltaY;

      const maxScrollTop = el.scrollHeight - el.clientHeight;
      if (maxScrollTop <= 2) {
        e.preventDefault();
        queueWindowScroll(delta);
        return;
      }

      if (delta > 0) {
        const remainingDown = maxScrollTop - el.scrollTop;
        if (remainingDown <= 1) {
          e.preventDefault();
          queueWindowScroll(delta);
        } else if (delta > remainingDown) {
          e.preventDefault();
          el.scrollTop = maxScrollTop;
          queueWindowScroll(delta - remainingDown);
        }
      } else if (delta < 0) {
        const remainingUp = el.scrollTop;
        if (remainingUp <= 1) {
          e.preventDefault();
          queueWindowScroll(delta);
        } else if (-delta > remainingUp) {
          e.preventDefault();
          el.scrollTop = 0;
          queueWindowScroll(delta + remainingUp);
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scrollContainerRef]);
}
