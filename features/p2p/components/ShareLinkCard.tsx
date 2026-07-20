'use client';

import { CopyButton } from '@/components/ui/CopyButton';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { QrCode } from './QrCode';

/** Share URL + QR code card used by every P2P flow (file transfer, chat…). */
export function ShareLinkCard({
  title,
  hint,
  url,
  copyLabel,
  qrAlt,
  bare = false,
}: {
  title: string;
  hint: string;
  url: string;
  copyLabel: string;
  qrAlt: string;
  /** Render without the card box (plain heading + content), e.g. when already
   *  inside another section, to avoid a nested box. */
  bare?: boolean;
}) {
  const content = (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <QrCode value={url} alt={qrAlt} />
      <div className="flex-1 min-w-0 w-full space-y-3">
        <p
          className="font-mono text-xs break-all rounded-xl border p-3"
          style={{
            color: 'var(--color-text-main)',
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
          }}
        >
          {url}
        </p>
        <CopyButton value={url} label={copyLabel} size="md" />
      </div>
    </div>
  );

  if (bare) {
    return (
      <div className="space-y-4">
        {(title || hint) && (
          <div className="space-y-1">
            {title && (
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                {title}
              </h3>
            )}
            {hint && (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {hint}
              </p>
            )}
          </div>
        )}
        {content}
      </div>
    );
  }

  return (
    <ToolSection title={title} hint={hint}>
      {content}
    </ToolSection>
  );
}
