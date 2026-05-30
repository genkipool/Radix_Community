'use client';
import { createContext, useEffect, useState, ReactNode } from 'react';

interface AnimationContextType {
  canAnimate: boolean;
}

const AnimationContext = createContext<AnimationContextType>({ canAnimate: false });

export function AnimationProvider({ children }: { children: ReactNode }) {
  // canAnimate starts false during SSR and the first paint.
  // Elements visible on initial load render with `initial=false` (no animation).
  // After the first paint completes, canAnimate becomes true so that
  // elements entering the viewport via scroll will animate in.
  const [canAnimate, setCanAnimate] = useState(false);

  useEffect(() => {
    // requestAnimationFrame waits for the next paint, then the nested
    // rAF fires after that paint is flushed — guaranteeing the first
    // frame is fully rendered before we enable animations.
    const outer = requestAnimationFrame(() => {
      const inner = requestAnimationFrame(() => {
        setCanAnimate(true);
      });
      return () => cancelAnimationFrame(inner);
    });
    return () => cancelAnimationFrame(outer);
  }, []);

  const value = { canAnimate };

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  );
}


