'use client';
import { ReactNode, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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
 */
export default function NavPopup({
  trigger,
  children,
  align = 'left',
  width = 'w-72',
  prefetchHrefs = [],
  keepOpenOnTriggerClick = false,
  offsetClass = 'absolute top-[calc(100%-12px)]',
}: NavPopupProps) {
  const router = useRouter();
  const prefetchedRef = useRef(false);
  const forceOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [forceOpen, setForceOpen] = useState(false);

  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'left-0';

  const handleMouseEnter = () => {
    if (prefetchedRef.current || prefetchHrefs.length === 0) return;
    prefetchedRef.current = true;
    prefetchHrefs.forEach((href) => {
      if (!href.startsWith('http')) router.prefetch(href);
    });
  };

  const handleMouseLeave = () => {
    if (forceOpen) {
      if (forceOpenTimerRef.current) clearTimeout(forceOpenTimerRef.current);
      setForceOpen(false);
    }
  };

  const handleTriggerClick = () => {
    if (!keepOpenOnTriggerClick) return;
    setForceOpen(true);
    if (forceOpenTimerRef.current) clearTimeout(forceOpenTimerRef.current);
    forceOpenTimerRef.current = setTimeout(() => setForceOpen(false), 600);
  };

  return (
    // self-stretch + flex items-center: fills full navbar height, centers trigger vertically
    <div
      className="relative group/navpopup self-stretch flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClickCapture={keepOpenOnTriggerClick ? handleTriggerClick : undefined}
    >
      {trigger}
      {/* Invisible bridge prevents losing hover while cursor moves from nav to popup */}
      <div className="absolute top-full left-0 right-0 h-8 pointer-events-auto z-[45]" />
      <div
        className={[
          offsetClass,
          alignClass,
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
