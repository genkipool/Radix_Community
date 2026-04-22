'use client';

import '@/app/globals.css';
import { useEffect, useState } from 'react';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';
import { Providers } from '@/components/layout/Providers';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundContent } from '@/components/error/NotFoundContent';
import { getCookie } from '@/utils/cookies';
import { Theme } from '@/context/ThemeContext';

/**
 * Root not-found.tsx
 *
 * Catches unhandled 404s at the root app level — outside the [locale]
 * segment. This is the global 404 page for invalid base URLs.
 *
 * Must include <html> and <body> since it replaces the root layout entirely.
 */
export default function NotFound() {
  // Client-side detection for root not-found outside the [locale] param
  const [locale, setLocale] = useState<'en' | 'es'>('en');
  const [theme, setTheme] = useState<Theme>('radix-dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Detect Locale from URL
      const isEsPath = window.location.pathname.startsWith('/es');
      setLocale(isEsPath ? 'es' : 'en');

      // Detect Theme from Cookies
      const savedTheme = getCookie('theme') as Theme;
      if (savedTheme) setTheme(savedTheme);
    }
  }, []);

  const dictionary = locale === 'es' ? es : en;
  const t = dictionary.errors.not_found;

  return (
    <html lang={locale} className={theme} style={{ colorScheme: theme.includes('dark') ? 'dark' : 'light' }}>
      <body className="bg-[var(--color-bg)] font-sans text-[var(--color-text-main)] antialiased">
        <Providers locale={locale} dictionary={dictionary} theme={theme}>
          <AppShell>
            <NotFoundContent
              title={t.title}
              description={t.desc}
              status="404"
              ctaText={t.cta}
              homePath={`/${locale}`}
            />
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
