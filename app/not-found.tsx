'use client';

import '@/app/globals.css';
import { useMounted } from '@/hooks/useMounted';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';
import { Providers } from '@/components/layout/Providers';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundContent } from '@/components/error/NotFoundContent';

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
  const mounted = useMounted();
  const locale = mounted && typeof window !== 'undefined' && window.location.pathname.startsWith('/es') ? 'es' : 'en';

  const dictionary = locale === 'es' ? es : en;
  const t = dictionary.errors.not_found;

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
        <Providers locale={locale} dictionary={dictionary} theme="radix-dark">
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
