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

  // Alchemy Pay URL with fiat, theme, and language parameters.
  const fiatCurrency = language === 'es' ? 'EUR' : 'USD';
  const alchemyLang = language === 'es' ? 'es' : 'en-US';
  const src = `https://ramp.alchemypay.org/?crypto=XRD&network=XRD&fiat=${fiatCurrency}&language=${alchemyLang}&theme=${isDark ? 'dark' : 'light'}`;

  return (
    <div className="relative w-full max-w-[500px] mx-auto min-h-[625px]">
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
        height="625"
        allow="camera; microphone; fullscreen; payment"
        allowtransparency="true"
        onLoad={() => setIsLoading(false)}
        style={{
          width: '100%',
          border: 'none',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.5s ease-in-out'
        }}
      />
    </div>
  );
}
