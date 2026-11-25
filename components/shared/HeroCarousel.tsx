'use client';

/**
 * Shared HeroCarousel — lightweight CSS-animated hero banner carousel
 * (no motion library) used across Home, Hyperscale, Google Wallet, and
 * Radix Seal hero sections to keep LCP and hydration cost minimal.
 */
import { useEffect, useReducer, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMounted } from '@/hooks/useMounted';

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
  | { type: 'NEXT'; total: number }
  | { type: 'PREV'; total: number };

const initialState: CarouselState = {
  activeIdx: 0,
  exitingIdx: null,
  targetIdx: null,
  isPaused: false,
};

function carouselReducer(
  state: CarouselState,
  action: CarouselAction,
): CarouselState {
  switch (action.type) {
    case 'GO_TO':
      if (state.exitingIdx !== null || action.index === state.activeIdx) {
        return state;
      }
      return { ...state, exitingIdx: state.activeIdx, targetIdx: action.index };
    case 'NEXT':
      if (state.exitingIdx !== null) return state;
      return {
        ...state,
        exitingIdx: state.activeIdx,
        targetIdx: (state.activeIdx + 1) % action.total,
      };
    case 'PREV':
      if (state.exitingIdx !== null) return state;
      return {
        ...state,
        exitingIdx: state.activeIdx,
        targetIdx: (state.activeIdx - 1 + action.total) % action.total,
      };
    case 'COMPLETE_TRANSITION':
      return {
        ...state,
        activeIdx: state.targetIdx ?? state.activeIdx,
        exitingIdx: null,
        targetIdx: null,
      };
    case 'SET_PAUSED':
      return { ...state, isPaused: action.paused };
    default:
      return state;
  }
}

export interface SharedHeroCarouselProps<T> {
  slides: T[];
  keyOf: (slide: T, index: number) => string;
  renderSlide: (slide: T, index: number, Heading: 'h1' | 'h2') => ReactNode;
  prevLabel: string;
  nextLabel: string;
  goToLabel: string;
  intervalMs?: number;
  slidesClassName?: string;
  slideItemClassName?: string;
  controlsClassName?: string;
}

export function SharedHeroCarousel<T>({
  slides,
  keyOf,
  renderSlide,
  prevLabel,
  nextLabel,
  goToLabel,
  intervalMs = 5000,
  slidesClassName = 'grid mt-8',
  slideItemClassName = 'col-start-1 row-start-1 flex flex-col pt-4',
  controlsClassName = 'flex items-center gap-3 mt-6 mb-4',
}: SharedHeroCarouselProps<T>) {
  const [{ activeIdx, exitingIdx, targetIdx, isPaused }, dispatch] = useReducer(
    carouselReducer,
    initialState,
  );
  const mounted = useMounted();
  const total = slides.length;

  useEffect(() => {
    if (exitingIdx === null) return;
    const timer = setTimeout(
      () => dispatch({ type: 'COMPLETE_TRANSITION' }),
      500,
    );
    return () => clearTimeout(timer);
  }, [exitingIdx]);

  useEffect(() => {
    if (isPaused || exitingIdx !== null || total < 2) return;
    const timer = setInterval(
      () => dispatch({ type: 'NEXT', total }),
      intervalMs,
    );
    return () => clearInterval(timer);
  }, [isPaused, exitingIdx, total, intervalMs]);

  if (total === 0) return null;

  const durationSec = `${intervalMs / 1000}s`;

  return (
    <>
      <style>{`
        @keyframes shared-hero-progress-fill { from { width: 0%; } to { width: 100%; } }
      `}</style>

      <div className={slidesClassName}>
        {slides.map((slide, idx) => {
          const isVisible =
            activeIdx === idx || exitingIdx === idx || targetIdx === idx;
          const isExiting = exitingIdx === idx;
          const isEntering = targetIdx === idx;
          const animationClass = isExiting
            ? 'animate-hero-out'
            : isEntering
              ? 'animate-hero-in'
              : '';
          const hiddenClass = !isVisible
            ? 'opacity-0 invisible pointer-events-none'
            : '';
          const Heading = idx === 0 ? 'h1' : 'h2';

          return (
            <div
              key={keyOf(slide, idx)}
              className={`${slideItemClassName} ${animationClass} ${hiddenClass}`}
              onMouseEnter={() => dispatch({ type: 'SET_PAUSED', paused: true })}
              onMouseLeave={() =>
                dispatch({ type: 'SET_PAUSED', paused: false })
              }
            >
              {renderSlide(slide, idx, Heading)}
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <div
          className={controlsClassName}
          onMouseEnter={() => dispatch({ type: 'SET_PAUSED', paused: true })}
          onMouseLeave={() => dispatch({ type: 'SET_PAUSED', paused: false })}
        >
          <button
            type="button"
            onClick={() => dispatch({ type: 'PREV', total })}
            disabled={exitingIdx !== null}
            aria-label={prevLabel}
            className="group relative flex items-center justify-center size-7 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-muted)] shrink-0 overflow-hidden transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
          >
            <span className="absolute inset-0 rounded-full bg-[var(--color-text-main)]/6 opacity-0 group-hover:opacity-100 transition-opacity" />
            <ChevronLeft className="size-3.5 relative z-10" strokeWidth={2} />
          </button>

          {slides.map((slide, index) => (
            <button
              type="button"
              key={`indicator-${keyOf(slide, index)}`}
              onClick={() => dispatch({ type: 'GO_TO', index })}
              disabled={exitingIdx !== null}
              className="h-[3px] w-16 bg-[var(--color-text-main)]/15 rounded-full overflow-hidden cursor-pointer p-0 border-none outline-none relative transition-colors hover:bg-[var(--color-text-main)]/25 disabled:cursor-default"
              aria-label={`${goToLabel} ${index + 1}`}
            >
              <div
                key={`${index}-${activeIdx}`}
                className={`h-full rounded-full bg-[var(--color-secondary)] ${activeIdx === index ? 'opacity-100' : 'opacity-45'}`}
                style={{
                  width:
                    exitingIdx === index
                      ? targetIdx! > exitingIdx ||
                        (exitingIdx === total - 1 && targetIdx === 0)
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
                      ? `shared-hero-progress-fill ${durationSec} linear forwards`
                      : 'none',
                }}
              />
            </button>
          ))}

          <button
            type="button"
            onClick={() => dispatch({ type: 'NEXT', total })}
            disabled={exitingIdx !== null}
            aria-label={nextLabel}
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
