'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Renders `value` as a QR image (generated locally, nothing leaves the page). */
export function QrCode({
  value,
  alt,
  size = 220,
}: {
  value: string;
  alt: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className="rounded-2xl animate-pulse"
        style={{ width: size, height: size, background: 'var(--color-surface)' }}
      />
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- local data URL */
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className="rounded-2xl border bg-white p-2"
      style={{ borderColor: 'var(--color-card-border)' }}
    />
  );
}
