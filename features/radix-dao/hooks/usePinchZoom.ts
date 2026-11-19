import { useEffect, useState, type RefObject } from 'react';

interface UsePinchZoomOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomCommit: (nextZoom: number) => void;
}

function getTouchDistance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Smooth 2-finger pinch-to-zoom for touch devices.
 * Applies an instant CSS scale preview at 60fps during the gesture and commits
 * the exact target zoom on release so pdf.js re-renders crisp HiDPI pixels.
 */
export function usePinchZoom({
  containerRef,
  zoom,
  minZoom,
  maxZoom,
  onZoomCommit,
}: UsePinchZoomOptions): number {
  const [pinchScale, setPinchScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startDist = 0;
    let startZoom = zoom;
    let activeRatio = 1;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = getTouchDistance(e.touches);
        startZoom = zoom;
        activeRatio = 1;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || startDist <= 0) return;
      e.preventDefault();

      const currentDist = getTouchDistance(e.touches);
      const rawRatio = currentDist / startDist;
      const clampedZoom = clamp(startZoom * rawRatio, minZoom, maxZoom);
      activeRatio = clampedZoom / startZoom;
      setPinchScale(activeRatio);
    };

    const finishPinch = (e: TouchEvent) => {
      if (startDist <= 0 || e.touches.length >= 2) return;
      const nextZoom = clamp(Math.round(startZoom * activeRatio), minZoom, maxZoom);
      startDist = 0;
      activeRatio = 1;
      setPinchScale(1);

      if (nextZoom !== startZoom) {
        onZoomCommit(nextZoom);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', finishPinch, { passive: true });
    el.addEventListener('touchcancel', finishPinch, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', finishPinch);
      el.removeEventListener('touchcancel', finishPinch);
    };
  }, [containerRef, zoom, minZoom, maxZoom, onZoomCommit]);

  return pinchScale;
}
