'use client';

import React from 'react';
import * as PhaseGraphics from './PhaseGraphics';

interface LazyPhaseGraphicProps {
  num: number;
  t?: unknown;
}

/** Minimal animated placeholder shown while the graphic module loads */
function GraphicSkeleton() {
  return (
    <div
      className="w-full h-[120px] rounded-lg animate-pulse"
      style={{ background: 'var(--color-border, rgba(100,100,100,0.1))' }}
      aria-hidden="true"
    />
  );
}

const GRAPHIC_MAP: Record<number, React.ElementType> = {
  1: PhaseGraphics.Graphic1,
  2: PhaseGraphics.Graphic2,
  3: PhaseGraphics.Graphic3,
  4: PhaseGraphics.Graphic4,
  5: PhaseGraphics.Graphic5,
  6: PhaseGraphics.Graphic6,
  7: PhaseGraphics.Graphic7,
  8: PhaseGraphics.Graphic8,
  9: PhaseGraphics.Graphic9,
  10: PhaseGraphics.Graphic10,
  11: PhaseGraphics.Graphic11,
  12: PhaseGraphics.Graphic12,
  13: PhaseGraphics.Graphic13,
  14: PhaseGraphics.Graphic14,
  15: PhaseGraphics.Graphic15,
  16: PhaseGraphics.Graphic16,
  17: PhaseGraphics.Graphic17,
  18: PhaseGraphics.Graphic18,
  19: PhaseGraphics.Graphic19,
  20: PhaseGraphics.Graphic20,
  21: PhaseGraphics.Graphic21,
  22: PhaseGraphics.Graphic22,
  23: PhaseGraphics.Graphic23,
  24: PhaseGraphics.Graphic24,
  25: PhaseGraphics.Graphic25,
  26: PhaseGraphics.Graphic26,
  27: PhaseGraphics.Graphic27,
  28: PhaseGraphics.Graphic28,
  29: PhaseGraphics.Graphic29,
  30: PhaseGraphics.Graphic30,
  31: PhaseGraphics.Graphic31,
  32: PhaseGraphics.Graphic32,
};

export function LazyPhaseGraphic({ num, t }: LazyPhaseGraphicProps) {
  const Graphic = GRAPHIC_MAP[num];

  if (!Graphic) return <GraphicSkeleton />;

  return (
    <div className="w-full flex items-center justify-center overflow-visible">
      <Graphic t={t} />
    </div>
  );
}
