import '@/app/globals.css';
import { NotFoundContent } from '@/components/error/NotFoundContent';
import { en } from '@/i18n/locales/en';
import { es } from '@/i18n/locales/es';
import { Providers } from '@/components/layout/Providers';
import { AppShell } from '@/components/layout/AppShell';
import { cookies } from 'next/headers';
import type { Theme } from '@/context/ThemeContext';

/**
 * Global 404 page — rendered when Next.js cannot match any route at the
 * app level (outside the [locale] segment). 
 *
 * Persists theme and locale from cookies to maintain consistent branding.
 */
export default async function GlobalNotFound() {
  const cookieStore = await cookies();
  
  // Detect Theme
  const themeValue = cookieStore.get('theme')?.value;
  const theme: Theme = (themeValue === 'radix-light' || 
                        themeValue === 'radix-dark' || 
                        themeValue === 'oro-light' || 
                        themeValue === 'oro-dark' || 
                        themeValue === 'radix-original-light' || 
                        themeValue === 'radix-original-dark') 
                        ? themeValue as Theme 
                        : 'radix-dark';

  // Detect Locale
  const langValue = cookieStore.get('lang')?.value;
  const locale = (langValue === 'es') ? 'es' : 'en';
  
  const dictionary = locale === 'es' ? es : en;
  const { not_found } = dictionary.errors;

  return (
    <html lang={locale} className={theme} style={{ colorScheme: theme.includes('dark') ? 'dark' : 'light' }}>
      <body className="bg-[var(--color-bg)] font-sans text-[var(--color-text-main)] antialiased">
        <Providers locale={locale} dictionary={dictionary} theme={theme}>
          <AppShell>
            <NotFoundContent
              title={not_found.title}
              description={not_found.desc}
              ctaText={not_found.cta}
              status="404"
              homePath={`/${locale}`}
            />
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
