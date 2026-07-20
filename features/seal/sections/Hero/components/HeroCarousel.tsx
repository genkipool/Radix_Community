'use client';
/**
 * HeroCarousel — Client island of the Radix Seal hero.
 *
 * Same interaction model as the home / Hyperscale hero carousels: native CSS
 * animations (animate-hero-in / animate-hero-out from _themes/utilities.css)
 * driven by a useReducer, no motion library, so LCP and hydration stay cheap.
 *
 * When there is a single slide it renders it statically with no controls, so
 * the hero degrades gracefully; the carousel chrome only appears with two or
 * more banners.
 */
import { useReducer, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMounted } from '@/hooks/useMounted';
import type { Dictionary } from '@/types/i18n';

interface CarouselState {
  activeIdx: number;
  exitingIdx: number | null;
  targetIdx: number | null;
  isPaused: boolean;
}

type CarouselAction =
  | { type: 'GO_TO'; index: number }
  | { type: 'COMPLETE_TRANSITION' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'NEXT'; total: number };

const initialState: CarouselState = {
  activeIdx: 0,
  exitingIdx: null,
  targetIdx: null,
  isPaused: false,
};

function carouselReducer(state: CarouselState, action: CarouselAction): CarouselState {
  switch (action.type) {
    case 'GO_TO':
      if (state.exitingIdx !== null || action.index === state.activeIdx) return state;
      return { ...state, exitingIdx: state.activeIdx, targetIdx: action.index };
    case 'NEXT':
      if (state.exitingIdx !== null) return state;
      return { ...state, exitingIdx: state.activeIdx, targetIdx: (state.activeIdx + 1) % action.total };
    case 'COMPLETE_TRANSITION':
      return { ...state, activeIdx: state.targetIdx ?? state.activeIdx, exitingIdx: null, targetIdx: null };
    case 'SET_PAUSED':
      return { ...state, isPaused: action.paused };
    default:
      return state;
  }
}

interface Slide {
  h1a: string;
  h1b: string;
  p: string;
}

export default function HeroCarousel({ t }: { t: Dictionary }) {
  const hero = t.seal.hero;
  const slides: Slide[] = hero.slides ?? [];
  const [{ activeIdx, exitingIdx, targetIdx, isPaused }, dispatch] = useReducer(
    carouselReducer,
    initialState,
  );
  const mounted = useMounted();
  const TOTAL = slides.length;

  useEffect(() => {
    if (exitingIdx === null) return;
    const timer = setTimeout(() => dispatch({ type: 'COMPLETE_TRANSITION' }), 500);
    return () => clearTimeout(timer);
  }, [exitingIdx]);

  useEffect(() => {
    if (isPaused || exitingIdx !== null || TOTAL < 2) return;
    const timer = setInterval(() => dispatch({ type: 'NEXT', total: TOTAL }), 6000);
    return () => clearInterval(timer);
  }, [isPaused, exitingIdx, TOTAL]);

  if (TOTAL === 0) return null;

  return (
    <>
      <style>{`
        @keyframes seal-hero-progress-fill { from { width: 0%; } to { width: 100%; } }
      `}</style>

      {/* Slides (stacked in one grid cell, cross-fading) */}
      <div className="grid">
        {slides.map((slide, idx) => {
          const isVisible = activeIdx === idx || exitingIdx === idx || targetIdx === idx;
          const isExiting = exitingIdx === idx;
          const isEntering = targetIdx === idx;
          const animationClass = isExiting ? 'animate-hero-out' : isEntering ? 'animate-hero-in' : '';
          const hiddenClass = !isVisible ? 'opacity-0 invisible pointer-events-none' : '';

          return (
            <div
              key={slide.h1a}
              className={`col-start-1 row-start-1 flex flex-col ${animationClass} ${hiddenClass}`}
              onMouseEnter={() => dispatch({ type: 'SET_PAUSED', paused: true })}
              onMouseLeave={() => dispatch({ type: 'SET_PAUSED', paused: false })}
            >
              <h1 className="text-4xl md:text-6xl font-extrabold text-[var(--color-text-main)] tracking-tight leading-tight mb-6">
                {slide.h1a}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]">
                  {slide.h1b}
                </span>
              </h1>
              <p className="text-xl text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
                {slide.p}
              </p>
            </div>
          );
        })}
      </div>

      {/* Controls only make sense with more than one banner. */}
      {TOTAL > 1 && (
        <div
          className="flex items-center gap-3 mt-8"
          onMouseEnter={() => dispatch({ type: 'SET_PAUSED', paused: true })}
          onMouseLeave={() => dispatch({ type: 'SET_PAUSED', paused: false })}
        >
          <button
            type="button"
            onClick={() => dispatch({ type: 'GO_TO', index: (activeIdx - 1 + TOTAL) % TOTAL })}
            disabled={exitingIdx !== null}
            aria-label={hero.btn_prev}
            className="group relative flex items-center justify-center size-7 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-muted)] shrink-0 overflow-hidden transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
          >
            <span className="absolute inset-0 rounded-full bg-[var(--color-text-main)]/6 opacity-0 group-hover:opacity-100 transition-opacity" />
            <ChevronLeft className="size-3.5 relative z-10" strokeWidth={2} />
          </button>

          {slides.map((slide, index) => (
            <button
              type="button"
              key={`indicator-${slide.h1a}`}
              onClick={() => dispatch({ type: 'GO_TO', index })}
              disabled={exitingIdx !== null}
              className="h-[3px] w-16 bg-[var(--color-text-main)]/15 rounded-full overflow-hidden cursor-pointer p-0 border-none outline-none relative transition-colors hover:bg-[var(--color-text-main)]/25 disabled:cursor-default"
              aria-label={`${hero.aria_go} ${index + 1}`}
            >
              <div
                key={`${index}-${activeIdx}`}
                className={`h-full rounded-full bg-[var(--color-secondary)] ${activeIdx === index ? 'opacity-100' : 'opacity-45'}`}
                style={{
                  width:
                    exitingIdx === index
                      ? targetIdx! > exitingIdx || (exitingIdx === TOTAL - 1 && targetIdx === 0)
                        ? '100%'
                        : '0%'
                      : index < activeIdx
                        ? '100%'
                        : index > activeIdx
                          ? '0%'
                          : mounted && exitingIdx === null
                            ? '100%'
                            : '0%',
                  animation:
                    activeIdx === index && exitingIdx === null && mounted
                      ? 'seal-hero-progress-fill 6s linear forwards'
                      : 'none',
                }}
              />
            </button>
          ))}

          <button
            type="button"
            onClick={() => dispatch({ type: 'NEXT', total: TOTAL })}
            disabled={exitingIdx !== null}
            aria-label={hero.btn_next}
            className="group relative flex items-center justify-center size-7 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-muted)] shrink-0 overflow-hidden transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
          >
            <span className="absolute inset-0 rounded-full bg-[var(--color-text-main)]/6 opacity-0 group-hover:opacity-100 transition-opacity" />
            <ChevronRight className="size-3.5 relative z-10" strokeWidth={2} />
          </button>
        </div>
      )}
    </>
  );
}
