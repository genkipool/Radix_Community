'use client';

import { createContext, type ReactNode } from 'react';
import type { Dictionary } from '@/i18n';

/**
 * The console's dictionary as the server rendered the page with it, for any
 * component inside the console. The language context only learns it in an
 * effect, after the first render, so a component reading it from there would
 * render once without its texts.
 */
export const ConsoleDictionaryContext = createContext<Partial<Dictionary> | null>(null);

export function ConsoleDictionaryProvider({ dictionary, children }: { dictionary: Partial<Dictionary>; children: ReactNode }) {
  return <ConsoleDictionaryContext.Provider value={dictionary}>{children}</ConsoleDictionaryContext.Provider>;
}
