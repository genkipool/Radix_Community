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
    <>
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
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
        allowTransparency
        onLoad={() => setIsLoading(false)}
        style={{
          display: isLoading ? 'none' : 'block',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '625px',
          border: 'none',
          margin: '0 auto'
        }}
      />
    </>
  );
}
