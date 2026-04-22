'use client';

import '@/app/globals.css';
import { useEffect, useState } from 'react';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';
import { Providers } from '@/components/layout/Providers';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundContent } from '@/components/error/NotFoundContent';
import { Theme } from '@/context/ThemeContext';

/**
 * global-error.tsx
 *
 * Catches unhandled errors at the root app level — outside the [locale]
 * segment and its own error.tsx boundary. This is the last resort error UI.
 *
 * Must include <html> and <body> since it replaces the root layout entirely.
 */
export default function GlobalError({
  _error,
  reset,
}: {
  _error: Error & { digest?: string };
  reset: () => void;
}) {
  // Client-side detection for global-error outside the [locale] param
  const [locale, setLocale] = useState<'en' | 'es'>('en');
  const [theme] = useState<Theme>('radix-dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Detect Locale from URL
      const isEsPath = window.location.pathname.startsWith('/es');
      setLocale(isEsPath ? 'es' : 'en');
    }
  }, []);

  const dictionary = locale === 'es' ? es : en;
  const t = dictionary.errors.error_500;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var match = document.cookie.match(new RegExp('(^| )theme=([^;]+)'));
                var t = match ? match[2] : 'radix-dark';
                document.documentElement.className = t;
                document.documentElement.style.colorScheme = t.includes('dark') ? 'dark' : 'light';
              } catch (e) {}
            `
          }}
        />
      </head>
      <body className="bg-[var(--color-bg)] font-sans text-[var(--color-text-main)] antialiased">
        <Providers locale={locale} dictionary={dictionary} theme={theme}>
          <AppShell>
            <NotFoundContent
              title={t.title}
              description={t.desc}
              status="500"
              onRetry={() => reset()}
              retryText={t.retry}
              ctaText={t.cta}
              homePath={`/${locale}`}
            />
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
