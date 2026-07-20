'use client';

import { useState, type ReactNode } from 'react';
import { Copy, Radio, RefreshCw } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { QrCode } from '@/features/p2p/components/QrCode';
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
  /** Tab the link opens on (request links force the sign tab by themselves). */
  tab?: 'basic' | 'sign' | 'verify';
  /** Section title/hint overrides (defaults: the request-link copy). */
  title?: string;
  hint?: string;
  /** Extra share actions (e.g. the request-PDF download). */
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
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
          tab,
          sendRoomId: sendEnabled && bytes ? roomId : undefined,
        })
      : '';

  const copy = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const statusText =
    channel.phase === 'sending'
      ? t.onchain.sendSending
      : channel.phase === 'error'
        ? t.onchain.sendError
        : channel.deliveries > 0
          ? t.onchain.sendDelivered.replace('{count}', String(channel.deliveries))
          : t.onchain.sendWaiting;

  return (
    <ToolSection
      title={title ?? t.onchain.shareTitle}
      hint={hint ?? t.onchain.shareHint}
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {shareUrl && (
          <QrCode value={shareUrl} alt={t.onchain.qrAlt} size={160} />
        )}
        <div className="flex-1 min-w-0 w-full flex gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-xs font-mono outline-none"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          />
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 px-4 rounded-xl border font-bold text-xs"
            style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
          >
            <Copy className="size-3.5" />
            {copied ? t.onchain.copied : t.onchain.copy}
          </button>
        </div>
      </div>

      {bytes && (
        <div
          className="rounded-xl border p-3 space-y-1.5"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
          }}
        >
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendEnabled}
              onChange={(e) => setSendEnabled(e.target.checked)}
              className="size-3.5 accent-[var(--color-primary)]"
            />
            <span
              className="flex items-center gap-1.5 text-xs font-bold"
              style={{ color: 'var(--color-text-main)' }}
            >
              <Radio className="size-3.5" />
              {t.onchain.sendToggle}
            </span>
          </label>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t.onchain.sendToggleHint}
          </p>
          {sendEnabled && channel.phase !== 'idle' && (
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
                <RefreshCw
                  className={`size-3 shrink-0 ${channel.phase === 'sending' ? 'animate-spin' : ''}`}
                />
              )}
              {statusText}
            </p>
          )}
        </div>
      )}

      {children}
    </ToolSection>
  );
}
