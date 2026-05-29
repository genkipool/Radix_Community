'use client';
import { createContext, use, ReactNode, useState, useEffect } from "react";
import { mergeTranslations, type Dictionary } from "@/i18n";

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
  const [dict, setDict] = useState<Dictionary>(dictionary);
  const [prevDict, setPrevDict] = useState(dictionary);
  if (dictionary !== prevDict) {
    setPrevDict(dictionary);
    setDict(dictionary);
  }

  const enrich = (partial: Partial<Dictionary>) => {
    setDict(prev => {
      // Check if any of the incoming partial's top-level keys are actually new or different.
      // We focus on the features being loaded (home, dapps, etc.)
      const keys = Object.keys(partial) as Array<keyof Dictionary>;
      
      // If all keys in partial already exist in prev and we are not forcing an update,
      // skip merging to prevent render loops.
      const hasNewData = keys.some(key => prev[key] === undefined);
      
      if (!hasNewData) {
        return prev;
      }
      
      return mergeTranslations(prev, [partial as Record<string, unknown>]) as unknown as Dictionary;
    });
  };

  const value = { language, t: dict, enrich };

  return (
    <LanguageContext.Provider value={value}>
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
