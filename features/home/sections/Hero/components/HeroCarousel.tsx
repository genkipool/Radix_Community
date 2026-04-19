'use client';
/**
 * HeroCarousel — Optimized Client Component
 * 
 * Replaced Framer Motion with native CSS animations to significantly improve 
 * LCP (Largest Contentful Paint) and reduce hydration blocking time.
 */
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Dictionary } from '@/types/i18n';

export default function HeroCarousel({ t }: { t: Dictionary }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [exitingIdx, setExitingIdx] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const TOTAL = 3;

  const goTo = (nextIdx: number) => {
    if (exitingIdx !== null || nextIdx === activeIdx) return;
    
    // Set current as exiting
    setExitingIdx(activeIdx);
    
    // After animation duration, switch indices
    setTimeout(() => {
      setActiveIdx(nextIdx);
      setExitingIdx(null);
    }, 500); // Matches .animate-hero-out duration
  };

  const prev = () => goTo((activeIdx - 1 + TOTAL) % TOTAL);
  const next = () => goTo((activeIdx + 1) % TOTAL);

  useEffect(() => {
    if (isPaused || exitingIdx !== null) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, exitingIdx, next]);

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
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
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
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
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
