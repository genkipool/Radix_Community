'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { LayoutProvider } from '@/context/LayoutContext';
import { AnimationProvider } from '@/context/AnimationContext';
import { RadixWalletProvider } from '@/features/wallet/context/RadixWalletProvider';
import { getQueryClient } from '@/lib/queryClient';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/dictionaries';
import type { Theme } from '@/context/ThemeContext';
import { translations } from '@/i18n';

/**
 * Providers
 *
 * Mounts all context providers and the React Query client.
 * Uses a persistent getQueryClient() singleton on the browser to ensure
 * the cache survives route transitions (like language changes).
 */
export function Providers({
  children,
  locale,
  dictionary,
  theme,
}: {
  children: ReactNode;
  locale: Locale;
  dictionary: typeof translations.en;
  theme: Theme;
}) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme={theme}>
        <LanguageProvider language={locale} dictionary={dictionary}>
          <LayoutProvider>
            <AnimationProvider>
              <RadixWalletProvider>
                {children}
              </RadixWalletProvider>
            </AnimationProvider>
          </LayoutProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
