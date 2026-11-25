'use client';

import { SharedHeroCarousel } from '@/components/shared/HeroCarousel';
import type { Dictionary } from '@/types/i18n';

interface Slide {
  h1a: string;
  h1b: string;
  p: string;
}

export default function HeroCarousel({ t }: { t: Dictionary }) {
  const hero = t.seal.hero;
  const slides: Slide[] = hero.slides ?? [];

  return (
    <SharedHeroCarousel
      slides={slides}
      keyOf={(slide) => slide.h1a}
      intervalMs={6000}
      prevLabel={hero.btn_prev}
      nextLabel={hero.btn_next}
      goToLabel={hero.aria_go}
      slidesClassName="grid"
      slideItemClassName="col-start-1 row-start-1 flex flex-col"
      controlsClassName="flex items-center gap-3 mt-8"
      renderSlide={(slide, _idx, Heading) => (
        <>
          <Heading className="text-4xl md:text-6xl font-extrabold text-[var(--color-text-main)] tracking-tight leading-tight mb-6">
            {slide.h1a}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]">
              {slide.h1b}
            </span>
          </Heading>
          <p className="text-xl text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
            {slide.p}
          </p>
        </>
      )}
    />
  );
}
