'use client';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AlchemyPayWidget() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const isDark = theme.includes('dark');
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(Date.now());
  const [showRetry, setShowRetry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Alchemy Pay URL with fiat, theme, and language parameters.
  const fiatCurrency = language === 'es' ? 'EUR' : 'USD';
  const alchemyLang = language === 'es' ? 'es' : 'en-US';
  const src = `https://ramp.alchemypay.org/?crypto=XRD&network=XRD&fiat=${fiatCurrency}&language=${alchemyLang}&theme=${isDark ? 'dark' : 'light'}&t=${reloadKey}`;

  useEffect(() => {
    // Si está cargando, configuramos un timer para mostrar el botón de reintentar
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowRetry(true);
        // Autoreload la primera vez si falla después de 8 segundos
        if (retryCount === 0) {
          handleReload();
        }
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setShowRetry(false);
    }
  }, [isLoading, reloadKey, retryCount]);

  const handleReload = () => {
    setIsLoading(true);
    setShowRetry(false);
    setReloadKey(Date.now());
    setRetryCount(prev => prev + 1);
  };

  return (
    <div className="relative w-full max-w-[500px] mx-auto min-h-[625px]">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg)] z-10 px-4 text-center">
          <Loader2 className="size-8 animate-spin text-[var(--color-primary)] mb-4" />
          <p className="text-sm text-[var(--color-text-main)] font-bold mb-2">
            Conectando con Alchemy Pay...
          </p>
          
          <div className={`transition-opacity duration-500 flex flex-col items-center ${showRetry ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-[250px]">
              La conexión está tardando más de lo esperado. Si ves una imagen rota, podría ser tu bloqueador de anuncios.
            </p>
            <button
              onClick={handleReload}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-full text-xs font-bold text-[var(--color-text-main)] hover:border-[var(--color-primary)] transition-all"
            >
              <RefreshCw className="size-3.5" />
              Recargar Widget
            </button>
          </div>
        </div>
      )}
      <iframe
        key={reloadKey}
        src={src}
        title="Alchemy Pay On-Ramp"
        height="625"
        allow="camera; microphone; fullscreen; payment"
        onLoad={() => setIsLoading(false)}
        onError={() => setShowRetry(true)}
        className="w-full border-none rounded-b-2xl sm:rounded-2xl"
        style={{
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.5s ease-in-out'
        }}
      />
    </div>
  );
}
