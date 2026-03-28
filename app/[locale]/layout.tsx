// Vercel deployment test - minor change
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css'
import { Providers } from '@/components/layout/Providers';
import { AppShell } from '@/components/layout/AppShell';
import { getDictionary, Locale } from '@/i18n/dictionaries';
import { cookies } from 'next/headers';
import Script from 'next/script';
import type { Theme } from '@/context/ThemeContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getDictionary(locale as Locale);
  return {
    title: t.seo.root.title,
    description: t.seo.root.description,
    keywords: t.seo.root.keywords,
  };
}

export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'es' }];
}

const VALID_THEMES: Theme[] = [
  'radix-light',
  'radix-dark',
  'oro-light',
  'oro-dark',
  'radix-original-light',
  'radix-original-dark',
];

function parseTheme(value: string | undefined): Theme {
  if (value && (VALID_THEMES as string[]).includes(value)) {
    return value as Theme;
  }
  return 'radix-light';
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = resolvedParams.locale as Locale;
  const dictionary = await getDictionary(locale);
  const cookieStore = await cookies();
  const theme = parseTheme(cookieStore.get('theme')?.value);

  return (
    <html lang={locale} className={`${inter.variable} ${theme}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Blocking script 1: Theme
          Applies the saved theme class synchronously before any paint.
          Eliminates flash-of-wrong-theme in incognito / first visit.
        */}
        <Script
          id="theme-strategy"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=document.cookie.match(/(^|;\\s*)theme=([^;]+)/);var t=c?decodeURIComponent(c[2]):'radix-light';var h=document.documentElement;h.className=h.className.replace(/radix-light|radix-dark|oro-light|oro-dark|radix-original-light|radix-original-dark/g,' ').replace(/\\s+/g,' ').trim()+' '+t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers locale={locale} dictionary={dictionary} theme={theme}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
