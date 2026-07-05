'use client';
import { useTheme } from '@/context/ThemeContext';

interface Props {
  className?: string;
}

export default function GoogleRadixIntegrationLogo({ className = "w-full h-full" }: Props) {
  const { theme } = useTheme();
  
  const isGold = theme.includes('oro');
  const isStandardRadix = theme.startsWith('radix') && !theme.includes('original');

  const radixGradientStart = isStandardRadix ? 'var(--color-accent)' : 'var(--color-primary)';
  const radixGradientEnd = 'var(--color-secondary)';

  // Si es tema dorado, todas las piezas de Google adoptan el color primario (dorado).
  // Si no, conservan sus colores originales de marca.
  const googleColors = {
    red: isGold ? 'var(--color-primary)' : '#EA4335',
    blue: isGold ? 'var(--color-primary)' : '#4285F4',
    green: isGold ? 'var(--color-secondary)' : '#34A853',
    yellow: isGold ? 'var(--color-accent)' : '#FBBC05',
  };

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className}>
      <defs>
        <linearGradient id="radixGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={radixGradientStart} />
          <stop offset="100%" stopColor={radixGradientEnd} />
        </linearGradient>
      </defs>

      {/* Base de la G de Google */}
      <g>
        <path fill={googleColors.red} d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
        <path fill={googleColors.blue} d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill={googleColors.green} d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill={googleColors.yellow} d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      </g>

      {/* Símbolo de Radix */}
      <g transform="translate(4.5, 15.5) scale(0.12)">
        {/* Borde que crea el efecto de recorte (cutout). Usamos color-bg para fusionarlo con el fondo de la página o tarjeta. */}
        <path d="M0,91.1 L38.35,91.1 L85.85,158.1 L155.45,11 L223.9,11"
              fill="none"
              stroke="var(--color-bg)"
              strokeWidth="35"
              strokeLinecap="round"
              strokeLinejoin="round" />
              
        <path d="M0,91.1 L38.35,91.1 L85.85,158.1 L155.45,11 L223.9,11"
              fill="none"
              stroke="url(#radixGradient)"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round" />
      </g>
    </svg>
  );
}
