'use client';
/**
 * HeroCarousel — Optimized Client Component
 * 
 * Replaced Framer Motion with native CSS animations to significantly improve 
 * LCP (Largest Contentful Paint) and reduce hydration blocking time.
 */
import { useReducer, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      const nextIdx = (state.activeIdx + 1) % action.total;
      return { ...state, exitingIdx: state.activeIdx, targetIdx: nextIdx };
    }
    case 'PREV': {
      if (state.exitingIdx !== null) return state;
      const nextIdx = (state.activeIdx - 1 + action.total) % action.total;
      return { ...state, exitingIdx: state.activeIdx, targetIdx: nextIdx };
    }
    case 'COMPLETE_TRANSITION':
      if (state.targetIdx === null) return state;
      return { ...state, activeIdx: state.targetIdx, exitingIdx: null, targetIdx: null };
    case 'SET_PAUSED':
      return { ...state, isPaused: action.paused };
    default:
      return state;
  }
}

export default function HeroCarousel({ t }: { t: Dictionary }) {
  const [state, dispatch] = useReducer(carouselReducer, initialState);
  const { activeIdx, exitingIdx, isPaused } = state;

  const TOTAL = 3;

  // Handle transition timing
  useEffect(() => {
    if (exitingIdx === null) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'COMPLETE_TRANSITION' });
    }, 500);
    return () => clearTimeout(timer);
  }, [exitingIdx]);

  // Handle auto-play
  useEffect(() => {
    if (isPaused || exitingIdx !== null) return;
    const timer = setInterval(() => {
      dispatch({ type: 'NEXT', total: TOTAL });
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused, exitingIdx]);

  const goTo = (index: number) => dispatch({ type: 'GO_TO', index });
  const next = () => dispatch({ type: 'NEXT', total: TOTAL });
  const prev = () => dispatch({ type: 'PREV', total: TOTAL });

  const slides = [
    {
      h1a: t.hero.slide0.h1a,
      h1b: t.hero.slide0.h1b,
      h1c: t.hero.slide0.h1c,
      p: t.hero.slide0.p,
      gradient: 'from-[var(--color-secondary)] to-[var(--color-primary)]',
    },
    {
      h1a: t.hero.slide1.h1a,
      h1b: t.hero.slide1.h1b,
      h1c: t.hero.slide1.h1c,
      p: t.hero.slide1.p,
      gradient: 'from-[var(--color-secondary)] to-[var(--color-primary)]',
    },
    {
      h1a: t.hero.slide2.h1a,
      h1b: t.hero.slide2.h1b,
      h1c: t.hero.slide2.h1c,
      p: t.hero.slide2.p,
      gradient: 'from-[var(--color-accent)] to-[var(--color-secondary)]',
    },
  ];

  return (
    <>
      {/* Slides */}
      <div className="relative h-[320px] sm:h-[280px] mt-8">
        {slides.map((slide, idx) => {
          const isVisible = activeIdx === idx || exitingIdx === idx;
          if (!isVisible) return null;

          const isExiting = exitingIdx === idx;

          return (
            <div
              key={`slide-${idx}`}
              className={`absolute inset-0 ${isExiting ? 'animate-hero-out' : 'animate-hero-in'}`}
              onMouseEnter={() => dispatch({ type: 'SET_PAUSED', paused: true })}
              onMouseLeave={() => dispatch({ type: 'SET_PAUSED', paused: false })}
            >
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-main)] mb-4 leading-tight tracking-tighter">
                <span>{slide.h1a}</span><br />
                <span className="text-[var(--color-text-main)]/80">{slide.h1b} </span>
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${slide.gradient}`}>
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
          onClick={prev}
          disabled={exitingIdx !== null}
          aria-label="Slide anterior"
          className="group relative flex items-center justify-center w-7 h-7 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-muted)] shrink-0 overflow-hidden transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
        >
          <span className="absolute inset-0 rounded-full bg-[var(--color-text-main)]/6 opacity-0 group-hover:opacity-100 transition-opacity" />
          <ChevronLeft className="w-3.5 h-3.5 relative z-10" strokeWidth={2} />
        </button>

        {[0, 1, 2].map((index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            disabled={exitingIdx !== null}
            className="h-[3px] w-16 bg-[var(--color-text-main)]/15 rounded-full overflow-hidden cursor-pointer p-0 border-none outline-none relative transition-colors hover:bg-[var(--color-text-main)]/25 disabled:cursor-default"
            aria-label={`Ir al slide ${index + 1}`}
          >
            <div
              className={`h-full rounded-full bg-[var(--color-secondary)] transition-all ${activeIdx === index ? 'opacity-100' : 'opacity-45'}`}
              style={{
                width: activeIdx === index ? '100%' : activeIdx > index ? '100%' : '0%',
                // Only animate the bar matching the active index
                transitionDuration: activeIdx === index && exitingIdx === null ? '5000ms' : '300ms',
                transitionTimingFunction: activeIdx === index && exitingIdx === null ? 'linear' : 'ease-out'
              }}
            />
          </button>
        ))}

        <button
          onClick={next}
          disabled={exitingIdx !== null}
          aria-label="Slide siguiente"
          className="group relative flex items-center justify-center w-7 h-7 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-muted)] shrink-0 overflow-hidden transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
        >
          <span className="absolute inset-0 rounded-full bg-[var(--color-text-main)]/6 opacity-0 group-hover:opacity-100 transition-opacity" />
          <ChevronRight className="w-3.5 h-3.5 relative z-10" strokeWidth={2} />
        </button>
      </div>
    </>
  );
}
