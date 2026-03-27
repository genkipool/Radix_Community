import type React from 'react';

// ── GraphicsModule type ───────────────────────────────────────────────────────
// Previously this file had `import * as Graphics from '../sections/Ecosystem/...'`
// to derive the module type. That static import pulled PhaseGraphics.css into
// the SSR module graph, making it render-blocking.
// The type is now defined generically — the runtime loading is handled by
// LazyPhaseGraphic (browser-only dynamic import).
export type GraphicsModule = Record<string, React.ComponentType<{ t?: unknown }>>;
export type GraphicKey = string;

export interface HomePhase {
  num: number;
  title: string;
  desc: string;
  tag: string;
}
