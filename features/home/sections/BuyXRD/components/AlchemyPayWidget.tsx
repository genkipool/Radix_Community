'use client';

import { useTheme } from '@/context/ThemeContext';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function AlchemyPayWidget() {
  const { theme } = useTheme();
  const isDark = theme.includes('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Alchemy Pay generic URL for buying XRD. We append the theme parameter to adapt it to the site's mode.
  const src = `https://ramp.alchemypay.org/?crypto=XRD&network=XRD&theme=${isDark ? 'dark' : 'light'}`;

  return (
    <div className="relative w-full h-[625px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl overflow-hidden shadow-lg group">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg)] z-10">
          <Loader2 className="size-8 animate-spin text-[var(--color-primary)] mb-4" />
          <p className="text-sm text-[var(--color-text-muted)] font-medium animate-pulse">
            Cargando Alchemy Pay...
          </p>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-primary)]/5 to-[var(--color-secondary)]/5 rounded-2xl blur-xl pointer-events-none group-hover:opacity-100 opacity-50 transition-opacity" />
      <iframe
        src={src}
        title="Alchemy Pay On-Ramp"
        width="100%"
        height="100%"
        frameBorder="0"
        allow="camera; microphone; fullscreen; payment"
        className="relative z-20 w-full h-full"
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
