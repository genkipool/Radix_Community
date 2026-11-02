'use client';
import { ReactNode, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { placePopup, fixedOrigin } from '@/components/layout/placePopup';

const EMPTY_HREFS: string[] = [];

/** Places a popup next to its trigger (the wrapper's first child) in window coordinates. */
function positionPopup(
  wrapper: HTMLElement | null,
  content: HTMLElement | null,
  align: 'left' | 'center' | 'right',
): void {
  const trigger = wrapper?.firstElementChild as HTMLElement | null | undefined;
  if (!content || !trigger) return;
  const t = trigger.getBoundingClientRect();
  if (!t.width && !t.height) return; // the button is not on screen at this width
  // Measured at its natural size: the limits from a previous placement are
  // lifted first, and it is moved to the left edge so a popup sized by its
  // content is not squeezed by where it happened to sit last time.
  content.style.left = '0px';
  content.style.maxHeight = '';
  content.style.maxWidth = '';
  content.style.overflowY = '';
  const spot = placePopup({
    trigger: t,
    width: content.offsetWidth,
    height: content.offsetHeight,
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: window.innerHeight,
    align,
  });
  const origin = fixedOrigin(content);
  content.style.left = `${spot.left - origin.x}px`;
  content.style.top = `${spot.top - origin.y}px`;
  content.dataset.side = spot.side;
  if (spot.maxWidth !== undefined) content.style.maxWidth = `${spot.maxWidth}px`;
  if (spot.maxHeight !== undefined) {
    content.style.maxHeight = `${spot.maxHeight}px`;
    content.style.overflowY = 'auto';
  }
}

interface NavPopupProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  /** Internal hrefs to prefetch when the popup is hovered */
  prefetchHrefs?: string[];
  /**
   * When true, clicking the trigger wrapper keeps the popup open so that
   * the user can interact with it after the click action completes (e.g.
   * after a language switch the popup stays visible without needing re-hover).
   */
  keepOpenOnTriggerClick?: boolean;
  offsetClass?: string;
  /**
   * Placed from where the button really is (see placePopup): lined up with it
   * by `align`, below it or above when below has no room, never over it, and
   * always inside the window. `offsetClass` is ignored.
   */
  anchored?: boolean;
  /**
   * When false a click on the trigger does not open the popup: it only opens
   * on hover, which Tailwind applies only where there is a real pointer. On a
   * touch screen the button keeps doing just what it does (the language and
   * theme buttons switch on a tap and open their sheet on a long press).
   */
  toggleOnClick?: boolean;
}

/**
 * Hover popup for Navbar items.
 *
 * Key design decisions:
 *
 * 1. Children are always mounted (no lazy render guard). The original
 *    `everHovered` guard was added to prevent an empty-popup flash caused by
 *    React Activity (cacheComponents). Since cacheComponents is disabled,
 *    Activity is off and the guard is no longer needed — removing it fixes
 *    the regression where the popup stayed empty after a language switch
 *    caused the component to remount with everHovered reset to false.
 *
 * 2. Visibility/opacity/transform are transitioned individually instead of
 *    `transition-all`. `transition-all` includes border-color and background-
 *    color, which means a momentary loss of CSS custom-property values (e.g.
 *    during an RSC navigation flush) would animate those properties through
 *    browser-default values (black borders, white text) for the duration of
 *    the transition.
 *
 * 3. Prefetches provided routes on first hover so page transitions feel instant.
 *
 * 4. keepOpenOnTriggerClick: adds a React-controlled forceOpen state that
 *    keeps the popup visible for 600 ms after any click inside the trigger,
 *    preventing the CSS hover state from being lost mid-navigation.
 *
 * 5. A popup opened with a click (without keepOpenOnTriggerClick) stays open
 *    when the pointer leaves: it closes with a click outside, Escape, or a new
 *    page. A popup can sit away from its trigger (clamped into a narrow
 *    window, or above the button in the mobile menu), and the pointer can only
 *    reach it by leaving the trigger: closing on leave made it unusable.
 *
 * 6. `anchored` popups are placed from the button's real position (see
 *    placePopup) instead of fixed CSS offsets, so they are right at every
 *    window size and never cover the button that opens them.
 */
export default function NavPopup({
  trigger,
  children,
  align = 'left',
  width = 'w-72',
  prefetchHrefs = EMPTY_HREFS,
  keepOpenOnTriggerClick = false,
  offsetClass = 'absolute top-[calc(100%-12px)]',
  anchored = false,
  toggleOnClick = true,
}: NavPopupProps) {
  const router = useRouter();
  const prefetchedRef = useRef(false);
  const forceOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [forceOpen, setForceOpen] = useState(false);

  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'left-0';

  /** Puts an anchored popup next to its button; a no-op for the others. */
  const place = () => {
    if (anchored) positionPopup(wrapperRef.current, contentRef.current, align);
  };

  // Placed before it is first seen, and again whenever the window, the button
  // or the popup's own content changes size.
  useLayoutEffect(() => {
    if (!anchored) return;
    const onResize = () => positionPopup(wrapperRef.current, contentRef.current, align);
    onResize();
    window.addEventListener('resize', onResize);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (contentRef.current) observer?.observe(contentRef.current);
    const trigger = wrapperRef.current?.firstElementChild;
    if (trigger) observer?.observe(trigger);
    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [anchored, align]);

  // A popup opened inside something that scrolls (the mobile menu) follows its button.
  useEffect(() => {
    if (!anchored || !forceOpen) return;
    const onScroll = () => positionPopup(wrapperRef.current, contentRef.current, align);
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [anchored, forceOpen, align]);

  const handleMouseEnter = () => {
    place();
    if (prefetchedRef.current || prefetchHrefs.length === 0) return;
    prefetchedRef.current = true;
    const { prefetch } = router;
    prefetchHrefs.forEach((href) => {
      if (!href.startsWith('http')) prefetch(href);
    });
  };

  // Only the short keep-open after a click on the trigger ends with the pointer
  // leaving; a popup opened with a click stays open (see 5 above).
  const handleMouseLeave = () => {
    if (forceOpen && keepOpenOnTriggerClick) {
      if (forceOpenTimerRef.current) clearTimeout(forceOpenTimerRef.current);
      setForceOpen(false);
    }
  };

  // A new page closes a popup opened with a click.
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState(pathname);
  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    if (forceOpen) setForceOpen(false);
  }

  // Solución de raíz: capturamos los eventos de interacción a nivel del document (capture phase)
  // para evitar que lleguen a los elementos que están por debajo (ej. ValidatorCard)
  useEffect(() => {
    if (!forceOpen) return;

    const handleOutsideInteraction = (e: Event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        // Detenemos la propagación antes de que el evento llegue a React o a otros elementos del DOM
        e.stopPropagation();
        // Solo en eventos táctiles o de puntero para no romper comportamientos nativos de scroll si es posible,
        // pero evitamos el click/touch en las tarjetas.
        setForceOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setForceOpen(false);
    };

    // Usamos el parámetro `capture: true` para interceptar el evento bajando por el DOM
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideInteraction, true);
    document.addEventListener('touchstart', handleOutsideInteraction, true);
    document.addEventListener('mousedown', handleOutsideInteraction, true);
    document.addEventListener('click', handleOutsideInteraction, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideInteraction, true);
      document.removeEventListener('touchstart', handleOutsideInteraction, true);
      document.removeEventListener('mousedown', handleOutsideInteraction, true);
      document.removeEventListener('click', handleOutsideInteraction, true);
    };
  }, [forceOpen]);

  return (
    // self-stretch + flex items-center: fills full navbar height, centers trigger vertically
    <div
      ref={wrapperRef}
      className="relative group/navpopup self-stretch flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClickCapture={(e) => {
        if (contentRef.current?.contains(e.target as Node)) {
          return;
        }
        if (!toggleOnClick) return;
        place();
        // Allow mobile tap to toggle the popup visibility
        setForceOpen((prev) => !prev);
        if (keepOpenOnTriggerClick) {
          if (forceOpenTimerRef.current) clearTimeout(forceOpenTimerRef.current);
          forceOpenTimerRef.current = setTimeout(() => setForceOpen(false), 600);
        }
      }}
    >
      {trigger}
      {/* Invisible bridge prevents losing hover while cursor moves from nav to
          popup. Only exists WHILE the popup is already open (group hovered or
          force-open): otherwise it would catch hovers below the navbar and
          open popups without touching the trigger. */}
      <div
        className={`absolute top-full left-0 right-0 h-8 z-[45] ${
          forceOpen ? 'block' : 'hidden group-hover/navpopup:block'
        }`}
      />
      <div
        ref={contentRef}
        className={[
          anchored ? 'fixed left-0 top-0' : `${offsetClass} ${alignClass}`,
          width,
          'bg-[var(--color-card-bg)] border border-[var(--color-card-border)]',
          'rounded-2xl shadow-2xl shadow-black/20',
          forceOpen
            ? 'opacity-100 visible pointer-events-auto translate-y-0'
            : 'opacity-0 invisible pointer-events-none translate-y-1',
          'group-hover/navpopup:opacity-100 group-hover/navpopup:visible group-hover/navpopup:pointer-events-auto group-hover/navpopup:translate-y-0',
          'transition-[opacity,visibility,transform] duration-200 ease-out',
          'z-50',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
