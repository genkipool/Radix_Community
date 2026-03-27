'use client';
/**
 * HeroCarousel — Client Component (boundary)
 *
 * Only this island is hydrated: 3 animated slides + progress bars + arrow nav.
 * Parent Hero.tsx is RSC — the snippet, metrics bar, and badge ship as static HTML.
 */
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Dictionary } from '@/types/i18n';

export default function HeroCarousel({ t }: { t: Dictionary }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [transKey, setTransKey] = useState(0);

  const TOTAL = 3;

  const prev = () => { setCurrentSlide(s => (s - 1 + TOTAL) % TOTAL); setTransKey(k => k + 1); };
  const next = () => { setCurrentSlide(s => (s + 1) % TOTAL); setTransKey(k => k + 1); };

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide(p => (p + 1) % TOTAL);
      setTransKey(k => k + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused]);

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
        <AnimatePresence mode="wait" initial={false}>
          {slides.map((slide, idx) =>
            currentSlide === idx ? (
              <motion.div
                key={`slide-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
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
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
      </div>

      {/* Progress bars + arrows */}
      <div
        className="flex items-center gap-3 mt-6 mb-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <motion.button
          onClick={prev}
          aria-label="Slide anterior"
          className="relative flex items-center justify-center w-7 h-7 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-muted)] shrink-0 overflow-hidden"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.93 }}
          transition={{ duration: 0.15 }}
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-[var(--color-text-main)]/6"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
          <ChevronLeft className="w-3.5 h-3.5 relative z-10" strokeWidth={2} />
        </motion.button>

        {[0, 1, 2].map((index) => (
          <button
            key={index}
            onClick={() => { setCurrentSlide(index); setTransKey(k => k + 1); }}
            className="h-[3px] w-16 bg-[var(--color-text-main)]/15 rounded-full overflow-hidden cursor-pointer p-0 border-none outline-none relative transition-colors hover:bg-[var(--color-text-main)]/25"
            aria-label={`Ir al slide ${index + 1}`}
          >
            <motion.div
              key={currentSlide === index ? `active-${transKey}` : `bar-${index}`}
              className="h-full rounded-full bg-[var(--color-secondary)]"
              initial={currentSlide === index ? { width: '0%', opacity: 1 } : false}
              animate={{
                width: currentSlide === index ? '100%' : currentSlide > index ? '100%' : '0%',
                opacity: currentSlide > index ? 0.45 : 1,
              }}
              transition={{
                width: {
                  duration: currentSlide === index ? 5 : 0.3,
                  ease: currentSlide === index ? 'linear' : 'easeOut',
                },
                opacity: { duration: 0.2 },
              }}
            />
          </button>
        ))}

        <motion.button
          onClick={next}
          aria-label="Slide siguiente"
          className="relative flex items-center justify-center w-7 h-7 rounded-full border border-[var(--color-card-border)] text-[var(--color-text-muted)] shrink-0 overflow-hidden"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.93 }}
          transition={{ duration: 0.15 }}
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-[var(--color-text-main)]/6"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
          <ChevronRight className="w-3.5 h-3.5 relative z-10" strokeWidth={2} />
        </motion.button>
      </div>
    </>
  );
}
