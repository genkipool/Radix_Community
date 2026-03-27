'use client';

import { useLanguage } from '@/context/LanguageContext';
import { NotFoundContent } from '@/components/error/NotFoundContent';

/**
 * Custom 404 page for the [locale] segment.
 * Rendered automatically by Next.js when `notFound()` is called
 * or when a route does not match any page.
 */
export default function NotFoundPage() {
  const { t, language: locale } = useLanguage();
  const { not_found } = t.errors;

  return (
    <NotFoundContent
      title={not_found.title}
      description={not_found.desc}
      ctaText={not_found.cta}
      status="404"
      homePath={`/${locale}`}
    />
  );
}
