// Vercel deployment test - minor change
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/app/globals.css';
import { Providers } from '@/components/layout/Providers';
import { AppShell } from '@/components/layout/AppShell';
import { getFeatureDictionary, Locale } from '@/i18n/dictionaries';
import { BASE_URL, SITE_NAME, buildMetadata } from '@/lib/seo';
import { buildSiteJsonLd, jsonLdScript } from '@/lib/structured-data';
import { cookies } from 'next/headers';
import Script from 'next/script';
import type { Theme } from '@/context/ThemeContext';
import { verifySessionJWT } from '@/lib/auth/session';
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ['latin'],
  display: 'optional',
  variable: '--font-inter',
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getFeatureDictionary(locale as Locale, []);
  return {
    // Lets every page hand relative asset paths (og:image, icons) to the
    // Metadata API and get absolute URLs in the output; crawlers reject
    // relative ones.
    metadataBase: new URL(BASE_URL),
    applicationName: SITE_NAME,
    ...buildMetadata({
      locale,
      pathname: '',
      title: t.seo.root.title,
      description: t.seo.root.description,
      keywords: t.seo.root.keywords,
    }),
    manifest: '/manifest.json',
  };
}

/**
 * `theme-color` tints the browser chrome on mobile. Both schemes are declared
 * so the bar doesn't stay dark-blue behind a light page (or vice versa).
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#052cc0' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

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
  const p = await params;
  const locale = p.locale as Locale;
  const [cookieStore, dictionary] = await Promise.all([
    cookies(),
    getFeatureDictionary(locale as Locale, [])
  ]);
  const theme = parseTheme(cookieStore.get('theme')?.value);

  // Read and verify wallet session from HttpOnly cookie
  const sessionToken = cookieStore.get('radix-session')?.value;
  const walletSession = sessionToken ? await verifySessionJWT(sessionToken) : null;
  const activeNetworkCookie = cookieStore.get('radix_active_network')?.value as 'mainnet' | 'stokenet' | undefined;

  const siteJsonLd = jsonLdScript(
    buildSiteJsonLd(locale, dictionary.seo.root.description as string)
  );

  return (
    <html lang={locale} className={`${inter.variable} ${theme}`} suppressHydrationWarning>
      <head>
        {/* Site identity for search engines and AI summarisers. Rendered as a
            plain <script> rather than next/script: JSON-LD is data, and
            deferring it past hydration hides it from crawlers that only read
            the initial HTML. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: siteJsonLd }}
        />
        <Script
          id="theme-strategy"
          >{`(function(){try{var c=document.cookie.match(/(^|;\\s*)theme=([^;]+)/);var t=c?decodeURIComponent(c[2]):'radix-light';var h=document.documentElement;h.className=h.className.replace(/radix-light|radix-dark|oro-light|oro-dark|radix-original-light|radix-original-dark/g,' ').replace(/\\s+/g,' ').trim()+' '+t;}catch(e){}})();`}</Script>
        <Script
          id="tz-strategy"
          >{`(function(){try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;var c=document.cookie.match(/(^|;\\s*)client-tz=([^;]+)/);if(!c||decodeURIComponent(c[2])!==z){document.cookie='client-tz='+encodeURIComponent(z)+';path=/;max-age=31536000';}}catch(e){}})();`}</Script>
      </head>
      <body suppressHydrationWarning>
        <Providers locale={locale} dictionary={dictionary} theme={theme} walletSession={walletSession} initialNetwork={activeNetworkCookie || null}>
          <AppShell>{children}</AppShell>
        </Providers>
        <Analytics />
        <SpeedInsights />
        {/* Cloudflare Web Analytics */}
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "9cbce8ab0aa640c7ace5d004c13b8d06"}'
        />
      </body>
    </html>
  );
}
