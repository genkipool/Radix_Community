'use client';

import type { ReactNode } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { ShareTargets } from '@/components/ui/ShareTargets';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { QrCode } from './QrCode';

/**
 * Share URL + QR code, shared by every P2P flow (signing, file transfer, chat)
 * so all three look identical.
 *
 * The link is presented flat on purpose: it is text to read and copy, not a
 * form field, so it carries no box of its own and the copy control is the bare
 * icon. Nesting boxes inside the surrounding panel only added visual noise.
 */
export function ShareLinkCard({
  title,
  hint,
  url,
  qrAlt,
  bare = false,
  children,
}: {
  title: string;
  hint: string;
  url: string;
  qrAlt: string;
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
        <div className="flex-1 min-w-0 w-full flex items-center gap-2">
          <span
            className="flex-1 min-w-0 font-mono text-xs break-all leading-relaxed"
            style={{ color: 'var(--color-text-main)' }}
          >
            {url}
          </span>
          <div className="flex shrink-0 items-center">
            <CopyButton value={url} variant="minimal" size="md" />
            <ShareTargets url={url} />
          </div>
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
