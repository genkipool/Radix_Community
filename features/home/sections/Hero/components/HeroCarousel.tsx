'use client';

import { SharedHeroCarousel } from '@/components/shared/HeroCarousel';
import type { Dictionary } from '@/types/i18n';

export default function HeroCarousel({ t }: { t: Dictionary }) {
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
    <SharedHeroCarousel
      slides={slides}
      keyOf={(slide) => slide.h1a}
      prevLabel={t.hero.btn_prev || 'Slide anterior'}
      nextLabel={t.hero.btn_next || 'Slide siguiente'}
      goToLabel={t.hero.aria_go || 'Ir al slide'}
      renderSlide={(slide, _idx, Heading) => (
        <>
          <Heading className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-main)] mb-4 leading-tight tracking-tighter">
            <span>{slide.h1a}</span>
            <br />
            <span className="text-[var(--color-text-main)]/80">
              {slide.h1b}{' '}
            </span>
            <span
              className={`text-transparent bg-clip-text bg-gradient-to-r ${slide.gradient}`}
            >
              {slide.h1c}
            </span>
          </Heading>
          <p className="text-lg text-[var(--color-text-muted)] leading-relaxed max-w-xl">
            {slide.p}
          </p>
        </>
      )}
    />
  );
}
