'use client';

import { useLanguage } from '@/context/LanguageContext';
import type { Dictionary } from '@/i18n';
import type { ConsoleDictionary } from '../types/i18n.types';

/**
 * Resolves the `console` dictionary namespace, preferring an SSR-provided
 * partial dictionary (no flash) and falling back to the language context.
 */
export function useConsoleDictionary(dictionary?: Partial<Dictionary>): ConsoleDictionary {
  const { t } = useLanguage();
  return ((dictionary?.console || t?.console) ?? {}) as ConsoleDictionary;
}
