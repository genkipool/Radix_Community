'use client';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function AlchemyPayWidget() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const isDark = theme.includes('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Alchemy Pay generic URL for buying XRD. We append the theme and fiat parameters.
  const fiatCurrency = language === 'es' ? 'EUR' : 'USD';
  const src = `https://ramp.alchemypay.org/?crypto=XRD&network=XRD&fiat=${fiatCurrency}&theme=${isDark ? 'dark' : 'light'}`;

  return (
    <div className="relative w-full mx-auto overflow-hidden rounded-2xl h-[620px]">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg)] z-10">
          <Loader2 className="size-8 animate-spin text-[var(--color-primary)] mb-4" />
          <p className="text-sm text-[var(--color-text-muted)] font-medium animate-pulse">
            Cargando Alchemy Pay...
          </p>
        </div>
      )}
      <iframe
        src={src}
        title="Alchemy Pay On-Ramp"
        allow="camera; microphone; fullscreen; payment"
        onLoad={() => setIsLoading(false)}
        className="relative z-20 w-full h-full border-none"
      />
    </div>
  );
}
