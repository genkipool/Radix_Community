'use client';

import { useContext } from 'react';

import { useLanguage } from '@/context/LanguageContext';
import type { Dictionary } from '@/i18n';
import { ConsoleDictionaryContext } from '../ConsoleDictionary';
import type { ConsoleDictionary } from '../types/i18n.types';

/**
 * Resolves the `console` dictionary namespace, preferring an SSR-provided
 * partial dictionary (no flash): the one passed in, else the one the console
 * shell provides, else the language context.
 */
export function useConsoleDictionary(dictionary?: Partial<Dictionary>): ConsoleDictionary {
  const { t } = useLanguage();
  const provided = useContext(ConsoleDictionaryContext);
  return ((dictionary?.console || provided?.console || t?.console) ?? {}) as ConsoleDictionary;
}
