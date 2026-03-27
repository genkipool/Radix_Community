'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { NotFoundContent } from '@/components/error/NotFoundContent';

interface ErrorPageProps {
  _error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for the [locale] segment.
 * Catches unhandled runtime errors and displays a friendly fallback
 * without crashing the entire UI.
 */
export default function ErrorPage({ _error, reset }: ErrorPageProps) {
  const { t, language: locale } = useLanguage();
  const { error_500 } = t.errors;

  useEffect(() => {
    // Next.js automáticamente emite los errores críticos al servidor (Pino).
    // Aquí omitimos console.error en cumplimiento estricto con la regla "Cero console.log".
  }, [_error]);

  return (
    <NotFoundContent
      title={error_500.title}
      description={error_500.desc}
      ctaText={error_500.cta}
      status="500"
      onRetry={() => reset()}
      retryText={error_500.retry}
      homePath={`/${locale}`}
    />
  );
}
