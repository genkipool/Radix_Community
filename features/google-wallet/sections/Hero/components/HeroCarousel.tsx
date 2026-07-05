'use client';
/**
 * HeroCarousel — Client island of the Google Wallet × Radix hero
 *
 * Same interaction model as the home and Hyperscale hero carousels: native
 * CSS animations (animate-hero-in / animate-hero-out from
 * _themes/utilities.css) instead of a motion library, keeping LCP and
 * hydration cost minimal.
 */
import { useReducer, useEffect } from 'react';
import { useMounted } from '@/hooks/useMounted';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Dictionary } from '@/types/i18n';

const SLIDE_GRADIENTS = [
  'from-[var(--color-secondary)] to-[var(--color-primary)]',
  'from-[var(--color-secondary)] to-[var(--color-primary)]',
  'from-[var(--color-accent)] to-[var(--color-secondary)]',
];

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

function carouselReducer(state: CarouselState, action: CarouselAction): CarouselState {
  switch (action.type) {
    case 'GO_TO':
      if (state.exitingIdx !== null || action.index === state.activeIdx) return state;
      return { ...state, exitingIdx: state.activeIdx, targetIdx: action.index };
    case 'NEXT': {
      if (state.exitingIdx !== null) return state;
      return { ...state, exitingIdx: state.activeIdx, targetIdx: (state.activeIdx + 1) % action.total };
    }
    case 'PREV': {
      if (state.exitingIdx !== null) return state;
      return { ...state, exitingIdx: state.activeIdx, targetIdx: (state.activeIdx - 1 + action.total) % action.total };
    }
    case 'COMPLETE_TRANSITION':
      return { ...state, activeIdx: state.targetIdx ?? state.activeIdx, exitingIdx: null, targetIdx: null };
    case 'SET_PAUSED':
      return { ...state, isPaused: action.paused };
    default:
      return state;
  }
}

export default function HeroCarousel({ t }: { t: Dictionary }) {
  const [{ activeIdx, exitingIdx, targetIdx, isPaused }, dispatch] = useReducer(carouselReducer, initialState);
  const mounted = useMounted();

  const slides = t.googleWallet.hero.slides;
  const TOTAL = slides.length;

  // Handle transition timing
  useEffect(() => {
    if (exitingIdx === null) return;
    const timer = setTimeout(() => dispatch({ type: 'COMPLETE_TRANSITION' }), 500);
    return () => clearTimeout(timer);
  }, [exitingIdx]);

  // Handle auto-play
  useEffect(() => {
    if (isPaused || exitingIdx !== null) return;
    const timer = setInterval(() => dispatch({ type: 'NEXT', total: TOTAL }), 5000);
    return () => clearInterval(timer);
  }, [isPaused, exitingIdx, TOTAL]);

  return (
    <>
      <style>{`
        @keyframes gw-hero-progress-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      {/* Slides */}
      <div className="grid mt-8">
        {slides.map((slide, idx) => {
          const isVisible = activeIdx === idx || exitingIdx === idx || targetIdx === idx;

          const isExiting = exitingIdx === idx;
          const isEntering = targetIdx === idx;

          const animationClass = isExiting ? 'animate-hero-out' : (isEntering ? 'animate-hero-in' : '');
          const hiddenClass = !isVisible ? 'opacity-0 invisible pointer-events-none' : '';

          return (
            <div
              key={slide.h1a}
              className={`col-start-1 row-start-1 flex flex-col pt-4 ${animationClass} ${hiddenClass}`}
              onMouseEnter={() => dispatch({ type: 'SET_PAUSED', paused: true })}
              onMouseLeave={() => dispatch({ type: 'SET_PAUSED', paused: false })}
            >
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-main)] mb-4 leading-tight tracking-tighter">
                <span>{slide.h1a}</span><br />
                <span className="text-[var(--color-text-main)]/80">{slide.h1b}</span>
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${SLIDE_GRADIENTS[idx % SLIDE_GRADIENTS.length]}`}>
                  {slide.h1c}
                </span>
              </h1>
              <p className="text-lg text-[var(--color-text-muted)] leading-relaxed max-w-xl">{slide.p}</p>
            </div>
          );
        })}
      </div>

      {/* Progress bars + arrows */}
      <div
        className="flex items-center gap-3 mt-6 mb-4"
        onMouseEnter={() => dispatch({ type: 'SET_PAUSED', paused: true })}
        onMouseLeave={() => dispatch({ type: 'SET_PAUSED', paused: false })}
      >
        <button
          type="button"
          onClick={() => dispatch({ type: 'PREV', total: TOTAL })}
          disabled={exitingIdx !== null}
          aria-label={t.googleWallet.hero.btn_prev}
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
            aria-label={`${t.googleWallet.hero.aria_go} ${index + 1}`}
          >
            <div
              key={`${index}-${activeIdx}`}
              className={`h-full rounded-full bg-[var(--color-secondary)] ${activeIdx === index ? 'opacity-100' : 'opacity-45'}`}
              style={{
                width:
                  exitingIdx === index ? (targetIdx! > exitingIdx || (exitingIdx === TOTAL - 1 && targetIdx === 0) ? '100%' : '0%') :
                    index < activeIdx ? '100%' :
                      index > activeIdx ? '0%' :
                        (mounted && exitingIdx === null) ? '100%' : '0%',
                animation: (activeIdx === index && exitingIdx === null && mounted)
                  ? 'gw-hero-progress-fill 5s linear forwards'
                  : 'none',
              }}
            />
          </button>
        ))}

        <button
          type="button"
          onClick={() => dispatch({ type: 'NEXT', total: TOTAL })}
          disabled={exitingIdx !== null}
          aria-label={t.googleWallet.hero.btn_next}
          className="group relative flex items-center justify-center size-7 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-muted)] shrink-0 overflow-hidden transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
        >
          <span className="absolute inset-0 rounded-full bg-[var(--color-text-main)]/6 opacity-0 group-hover:opacity-100 transition-opacity" />
          <ChevronRight className="size-3.5 relative z-10" strokeWidth={2} />
        </button>
      </div>
    </>
  );
}
