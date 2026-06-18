'use client';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';

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
    <div className="relative w-full max-w-[500px] mx-auto min-h-[625px] overflow-hidden rounded-2xl flex flex-col" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Botón superior siempre visible para abrir en nueva pestaña si falla */}
      <div className="w-full bg-[var(--color-surface)] p-3 border-b border-[var(--color-card-border)] flex items-center justify-between z-20 relative">
        <p className="text-xs text-[var(--color-text-muted)] leading-tight">
          ¿La pasarela aparece bloqueada?
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white rounded-lg text-xs font-bold transition-colors"
        >
          <ExternalLink className="size-3.5" />
          Abrir en otra pestaña
        </a>
      </div>

      <div className="relative flex-1 w-full h-full">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg)] z-10 px-4 text-center">
            <Loader2 className="size-8 animate-spin text-[var(--color-primary)] mb-4" />
            <p className="text-sm text-[var(--color-text-main)] font-bold mb-2">
              Conectando con Alchemy Pay...
            </p>
          </div>
        )}
        <iframe
          src={src}
          title="Alchemy Pay On-Ramp"
          allow="camera; microphone; fullscreen; payment"
          onLoad={() => setIsLoading(false)}
          className="absolute top-0 left-0 w-full h-full border-none"
          style={{
            opacity: isLoading ? 0.01 : 1, // Safari workaround
            transition: 'opacity 0.5s ease-in-out'
          }}
        />
      </div>
    </div>
  );
}
