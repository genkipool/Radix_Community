'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import QRCode from 'qrcode';

/** Renders `value` as a QR image (generated locally, nothing leaves the page).
 *  Pass `downloadName` to also show a button that saves the QR as a PNG. */
export function QrCode({
  value,
  alt,
  size = 220,
  downloadName,
  downloadLabel,
  framed = true,
}: {
  value: string;
  alt: string;
  size?: number;
  /** File name (with .png) for the save button; omit to hide the button. */
  downloadName?: string;
  /** Label of the save button; defaults to "Save". */
  downloadLabel?: string;
  /**
   * Draws the hairline around the code. Off when the code already sits inside
   * a panel of its own, where the frame is a second border over the first. The
   * white padding stays either way: that quiet zone is what a camera reads.
   */
  framed?: boolean;
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
  const image = (
    /* eslint-disable-next-line @next/next/no-img-element -- local data URL */
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-2xl bg-white p-2 ${framed ? 'border' : ''}`}
      style={framed ? { borderColor: 'var(--color-card-border)' } : undefined}
    />
  );

  if (!downloadName) return image;

  return (
    <div className="flex flex-col items-center gap-3">
      {image}
      <a
        href={dataUrl}
        download={downloadName}
        className="inline-flex items-center gap-2 px-4 h-9 rounded-full text-xs font-bold transition-colors hover:opacity-90"
        style={{ background: 'var(--color-surface)', color: 'var(--color-text-main)', border: '1px solid var(--color-card-border)' }}
      >
        <Download className="size-3.5" />
        {downloadLabel ?? 'Save'}
      </a>
    </div>
  );
}
