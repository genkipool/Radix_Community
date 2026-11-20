'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  MOBILE_RENDER_SCALE,
} from '../constants/radix-invaders.constants';

interface UseResponsiveCanvasParams {
  active: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  playfieldWrapRef: RefObject<HTMLDivElement | null>;
}

/**
 * Tracks mobile/portrait viewport mode and keeps the canvas bounding rect
 * and dynamic mobile-portrait internal height synced without layout reflows.
 */
export function useResponsiveCanvas({
  active,
  containerRef,
  canvasRef,
  playfieldWrapRef,
}: UseResponsiveCanvasParams) {
  const isMobileRef = useRef(false);
  const renderHRef = useRef<number>(CANVAS_H);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const syncViewportMode = () => {
      const mobile =
        window.innerWidth < 768 ||
        window.matchMedia('(pointer: coarse)').matches ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      isMobileRef.current = mobile;
      const portrait = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
      setIsMobilePortrait((prev) => (prev === portrait ? prev : portrait));
    };
    const container = containerRef.current;
    const ro = typeof ResizeObserver !== 'undefined' && container ? new ResizeObserver(syncViewportMode) : null;
    if (ro && container) ro.observe(container);
    window.addEventListener('resize', syncViewportMode, { passive: true });
    window.addEventListener('orientationchange', syncViewportMode, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncViewportMode);
      window.removeEventListener('orientationchange', syncViewportMode);
    };
  }, [containerRef]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateMetrics = () => {
      if (isMobilePortrait && playfieldWrapRef.current) {
        const wrapRect = playfieldWrapRef.current.getBoundingClientRect();
        if (wrapRect.width > 0 && wrapRect.height > 0) {
          const nextH = Math.round(
            Math.max(
              CANVAS_H,
              Math.min(MOBILE_RENDER_SCALE.maxPortraitH, CANVAS_W * (wrapRect.height / wrapRect.width)),
            ),
          );
          if (canvas.height !== nextH) {
            canvas.height = nextH;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (ctx) ctx.imageSmoothingEnabled = false;
          }
          renderHRef.current = nextH;
        }
      } else {
        if (canvas.height !== CANVAS_H) {
          canvas.height = CANVAS_H;
          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) ctx.imageSmoothingEnabled = false;
        }
        renderHRef.current = CANVAS_H;
      }
      canvasRectRef.current = canvas.getBoundingClientRect();
    };
    updateMetrics();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateMetrics) : null;
    if (ro) {
      ro.observe(canvas);
      if (playfieldWrapRef.current) ro.observe(playfieldWrapRef.current);
    }
    window.addEventListener('resize', updateMetrics, { passive: true });
    window.addEventListener('scroll', updateMetrics, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateMetrics);
      window.removeEventListener('scroll', updateMetrics);
      canvasRectRef.current = null;
    };
  }, [active, isMobilePortrait, canvasRef, playfieldWrapRef]);

  const getCanvasRect = (): DOMRect | null => {
    if (canvasRectRef.current && canvasRectRef.current.width > 0) return canvasRectRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    canvasRectRef.current = rect;
    return rect;
  };

  return { isMobileRef, isMobilePortrait, renderHRef, getCanvasRect };
}
