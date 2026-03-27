'use client';
import { createContext, useContext, ReactNode } from "react";
import { translations } from "@/i18n";

type Language = "en" | "es";

interface LanguageContextType {
  language: Language;
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  language,
  dictionary
}: {
  children: ReactNode;
  language: Language;
  dictionary: typeof translations.en;
}) {
  // React Compiler automatically memoizes the value object.
  const value = { language, t: dictionary };
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
