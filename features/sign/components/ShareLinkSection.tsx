'use client';

import { useState, type ReactNode } from 'react';
import { Ban, Radio, RefreshCw } from 'lucide-react';
import { ProgressRow } from '@/features/p2p/components/ProgressRow';
import { ShareLinkCard } from '@/features/p2p/components/ShareLinkCard';
import { randomRoomId } from '@/features/p2p/lib/session-url';
import { useSendFileChannel } from '../hooks/useFileChannel';
import { buildShareUrl, type SharedWatermark } from '../lib/share';
import type { OutputFormat } from '../types/sign.types';
import type { SignDictionary } from '../types/dictionary';

/**
 * The "share this link" box: URL + QR carrying the request (when there is
 * one), the document name and the delivery choices, plus the optional
 * (default ON) direct P2P document channel. While the toggle is on and this
 * tab stays open, anyone opening the link receives the document automatically;
 * the room id travels in the URL fragment. Without a request key the link is
 * a pure document-delivery URL (e.g. a signed PDF passed to the next signer).
 */
export function ShareLinkSection({
  t,
  requestKey,
  docName,
  fileName,
  fileType,
  bytes,
  outputs,
  watermark,
  networkId,
  tab,
  title,
  hint,
  children,
}: {
  t: SignDictionary;
  /** On-ledger request key; omit for a document-delivery-only link. */
  requestKey?: string;
  docName?: string;
  fileName: string | null;
  fileType: string | null;
  /** Document bytes for the direct channel; null hides the toggle. */
  bytes: Uint8Array | null;
  outputs: OutputFormat[];
  watermark?: SharedWatermark;
  /** Network the signature belongs to, so the link opens on the right ledger. */
  networkId?: number;
  /** Tab the link opens on (request links force the sign tab by themselves). */
  tab?: 'basic' | 'sign' | 'verify';
  /** Section title/hint overrides (defaults: the request-link copy). */
  title?: string;
  hint?: string;
  /** Extra share actions (e.g. the request-PDF download). */
  children?: ReactNode;
}) {
  // ON by default: the link delivers the document itself while the tab lives.
  const [sendEnabled, setSendEnabled] = useState(true);
  const [roomId] = useState(() => randomRoomId());

  const channel = useSendFileChannel({
    enabled: sendEnabled && !!bytes,
    roomId,
    fileName,
    fileType,
    bytes,
  });

  const shareUrl =
    typeof window !== 'undefined'
      ? buildShareUrl({
          origin: window.location.origin,
          pathname: window.location.pathname,
          requestKey,
          docName,
          outputs,
          watermark,
          networkId,
          tab,
          sendRoomId: sendEnabled && bytes ? roomId : undefined,
        })
      : '';

  const statusText =
    channel.phase === 'sending'
      ? t.onchain.sendSending
      : channel.phase === 'error'
        ? t.onchain.sendError
        : channel.deliveries > 0
          ? t.onchain.sendDelivered.replace('{count}', String(channel.deliveries))
          : t.onchain.sendWaiting;

  return (
    // The link + QR presentation is the SHARED one, so signing, file transfer
    // and chat look identical; only the direct-delivery panel below is specific
    // to signing.
    <ShareLinkCard
      title={title ?? t.onchain.shareTitle}
      hint={hint ?? t.onchain.shareHint}
      url={shareUrl}
      qrAlt={t.onchain.qrAlt}
    >

      {bytes && (
        <div
          className="rounded-xl border p-3.5 space-y-2.5"
          style={{
            background: 'var(--color-surface)',
            borderColor:
              sendEnabled && channel.phase === 'sending'
                ? 'var(--color-primary)'
                : 'var(--color-card-border)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <span
                className="flex items-center gap-1.5 text-xs font-bold"
                style={{ color: 'var(--color-text-main)' }}
              >
                <Radio className="size-3.5 shrink-0" />
                {t.onchain.sendToggle}
              </span>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t.onchain.sendToggleHint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSendEnabled((on) => !on)}
              className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {sendEnabled ? (
                <>
                  <Ban className="size-3.5" />
                  {t.onchain.sendCancel}
                </>
              ) : (
                <>
                  <Radio className="size-3.5" />
                  {t.onchain.sendResume}
                </>
              )}
            </button>
          </div>

          {sendEnabled && channel.phase === 'sending' ? (
            // Live delivery in flight: label + gradient bar + percentage.
            <ProgressRow label={t.onchain.sendSending} fraction={channel.progress} />
          ) : (
            sendEnabled &&
            channel.phase !== 'idle' && (
              <p
                className="flex items-center gap-1.5 text-[11px] font-semibold"
                style={{
                  color:
                    channel.phase === 'error'
                      ? 'var(--color-danger, #dc2626)'
                      : 'var(--color-text-muted)',
                }}
              >
                {channel.phase !== 'error' && (
                  <RefreshCw className="size-3 shrink-0" />
                )}
                {statusText}
              </p>
            )
          )}
        </div>
      )}

      {children}
    </ShareLinkCard>
  );
}
