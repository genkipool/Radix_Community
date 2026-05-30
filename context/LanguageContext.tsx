'use client';
import React, { useEffect, createContext, use, useState, ReactNode } from 'react';
import type { Dictionary } from "@/i18n";

type Language = "en" | "es";

interface LanguageContextType {
  language: Language;
  t: Dictionary;
  enrich: (partial: Partial<Dictionary>) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  language,
  dictionary
}: {
  children: ReactNode;
  language: Language;
  dictionary: Dictionary;
}) {
  const [state, setState] = useState({ prevDict: dictionary, dict: dictionary });

  if (dictionary !== state.prevDict) {
    setState({ prevDict: dictionary, dict: dictionary });
  }

  const enrich = (partial: Partial<Dictionary>) => {
    setState(s => {
      const prev = s.dict;
      // Check if any of the incoming partial's top-level keys are actually new or different.
      // We focus on the features being loaded (home, dapps, etc.)
      const keys = Object.keys(partial) as Array<keyof Dictionary>;
      
      // If all keys in partial already exist in prev and we are not forcing an update,
      // skip merging to prevent render loops.
      const hasNewData = keys.some(key => prev[key] === undefined);
      
      if (!hasNewData) return s;

      return { ...s, dict: { ...prev, ...partial } };
    });
  };

  return (
    <LanguageContext.Provider value={{ language, t: state.dict, enrich }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function DictionaryEnricher({ partial }: { partial: Partial<Dictionary> }) {
  const context = use(LanguageContext);
  if (!context) throw new Error("DictionaryEnricher must be used within LanguageProvider");

  useEffect(() => {
    if (partial) {
      context.enrich(partial);
    }
  }, [partial, context]);

  return null;
}

export function useLanguage() {
  const context = use(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
