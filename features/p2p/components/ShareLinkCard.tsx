'use client';

import type { ReactNode } from 'react';
import { ShareTargets } from '@/components/ui/ShareTargets';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { QrCode } from './QrCode';

/**
 * Share URL + QR code, shared by every P2P flow (signing, file transfer, chat)
 * so all three look identical.
 *
 * The link is presented flat on purpose: it is text to read and copy, not a
 * form field, so it carries no box of its own. It gets a line to itself and the
 * ways of sending it — WhatsApp, Telegram, clipboard — sit on the next one:
 * a share URL carries a long fragment, so anything beside it was competing with
 * text that wraps to three lines anyway.
 *
 * The share controls are {@link ShareTargets}, the same component the validator
 * cards use under their photo, so a link is sent the same way everywhere.
 */
export function ShareLinkCard({
  title,
  hint,
  url,
  qrAlt,
  copyLabel = 'Copy link',
  copiedLabel = 'Copied',
  bare = false,
  children,
}: {
  title: string;
  hint: string;
  url: string;
  qrAlt: string;
  /** Tooltip of the clipboard target (and its confirmation). */
  copyLabel?: string;
  copiedLabel?: string;
  /** Render without the card box (plain heading + content), e.g. when already
   *  inside another section, to avoid a nested box. */
  bare?: boolean;
  /** Extra content rendered under the link (status, toggles, actions…). */
  children?: ReactNode;
}) {
  const content = (
    <>
      <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
        <QrCode value={url} alt={qrAlt} size={160} />
        <div className="flex-1 min-w-0 w-full space-y-2">
          <span
            className="block min-w-0 font-mono text-xs break-all leading-relaxed"
            style={{ color: 'var(--color-text-main)' }}
          >
            {url}
          </span>
          <ShareTargets
            url={url}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
            className="-ml-2"
          />
        </div>
      </div>
      {children}
    </>
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
