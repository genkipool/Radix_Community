'use client';

import '@/app/globals.css';
import { useMounted } from '@/hooks/useMounted';
import { translations } from '@/i18n';
import { Providers } from '@/components/layout/Providers';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundContent } from '@/components/error/NotFoundContent';

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
  const mounted = useMounted();
  const locale = mounted && typeof window !== 'undefined' && window.location.pathname.startsWith('/es') ? 'es' : 'en';

  const dictionary = translations[locale as keyof typeof translations];
  const t = dictionary.errors.error_500;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
      </head>
      <body className="bg-[var(--color-bg)] font-sans text-[var(--color-text-main)] antialiased">
        <Providers locale={locale} dictionary={dictionary} theme="radix-dark">
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
