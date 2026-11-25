'use client';

import { SharedHeroCarousel } from '@/components/shared/HeroCarousel';
import type { Dictionary } from '@/types/i18n';

const SLIDE_GRADIENTS = [
  'from-[var(--color-secondary)] to-[var(--color-primary)]',
  'from-[var(--color-secondary)] to-[var(--color-primary)]',
  'from-[var(--color-accent)] to-[var(--color-secondary)]',
];

export default function HeroCarousel({ t }: { t: Dictionary }) {
  const hero = t.hyperscale.hero;

  return (
    <SharedHeroCarousel
      slides={hero.slides}
      keyOf={(slide) => slide.h1a}
      prevLabel={hero.btn_prev}
      nextLabel={hero.btn_next}
      goToLabel={hero.aria_go}
      renderSlide={(slide, idx, Heading) => (
        <>
          <Heading className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-main)] mb-4 leading-tight tracking-tighter">
            <span>{slide.h1a}</span>
            <br />
            <span className="text-[var(--color-text-main)]/80">
              {slide.h1b}
            </span>
            <span
              className={`text-transparent bg-clip-text bg-gradient-to-r ${SLIDE_GRADIENTS[idx % SLIDE_GRADIENTS.length]}`}
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
