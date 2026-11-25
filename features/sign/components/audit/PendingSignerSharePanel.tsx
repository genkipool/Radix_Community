'use client';

import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ExternalLink,
  FileUp,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { QrPopover } from '@/components/ui/QrPopover';
import { ShareTargets } from '@/components/ui/ShareTargets';
import { ProgressRow } from '@/features/p2p/components/ProgressRow';
import { randomRoomId } from '@/features/p2p/lib/session-url';
import { useSendFileChannel } from '../../hooks/useFileChannel';
import { blake2b256Hex } from '../../lib/hash';
import { buildShareUrl } from '../../lib/share';
import type { AuditLabels } from './AuditFormatters';

interface LoadedLocalFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

/**
 * Clean 2-column co-signer onboarding block shown inside expanded pending or
 * partial multi-party records:
 *  - Left: Optional WebRTC P2P file attachment (verified client-side against
 *    the on-ledger BLAKE2b-256 hash) with a clear green "Ready to share!" banner
 *  - Right: Direct signing share icons, QR & Open-to-sign link
 */
export function PendingSignerSharePanel({
  requestKey,
  docHash,
  pendingCount,
  networkId,
  locale,
  labels,
}: {
  requestKey: string;
  docHash: string;
  pendingCount: number;
  networkId: number;
  locale: string;
  labels: AuditLabels;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [roomId] = useState(() => randomRoomId());
  const [file, setFile] = useState<LoadedLocalFile | null>(null);
  const [sendEnabled, setSendEnabled] = useState(true);
  const [hashError, setHashError] = useState(false);

  const channel = useSendFileChannel({
    enabled: sendEnabled && !!file,
    roomId,
    fileName: file?.name ?? null,
    fileType: file?.type ?? null,
    bytes: file?.bytes ?? null,
  });

  const t = labels.records.pendingPanel;

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const signUrl = origin
    ? buildShareUrl({
        origin,
        pathname: `/${locale}/console/sign-document`,
        requestKey,
        docName: file?.name,
        networkId,
        sendRoomId: sendEnabled && file ? roomId : undefined,
      })
    : '';

  const handleSelectFile = async (picked: File | null) => {
    if (!picked) return;
    setHashError(false);
    const bytes = new Uint8Array(await picked.arrayBuffer());
    const computed = blake2b256Hex(bytes);
    if (computed.toLowerCase() !== docHash.toLowerCase()) {
      setHashError(true);
      setFile(null);
      return;
    }
    setFile({
      name: picked.name,
      type: picked.type || 'application/octet-stream',
      bytes,
    });
    setSendEnabled(true);
  };

  const p2pStatusText =
    channel.phase === 'sending'
      ? t.p2pSending
      : channel.phase === 'error'
        ? t.p2pError
        : channel.deliveries > 0
          ? t.p2pDelivered.replace('{count}', String(channel.deliveries))
          : t.p2pWaiting;

  return (
    <div className="border-t border-[var(--color-card-border)]/70 pt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Column 1 (Left): Attach file & open WebRTC P2P channel */}
      <div className="flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              <Radio className="size-3.5 shrink-0 text-[var(--color-primary)]" />
              {t.p2pTitle}
            </span>

            {file && (
              <button
                type="button"
                onClick={() => setSendEnabled((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
              >
                {sendEnabled ? (
                  <>
                    <Ban className="size-3" />
                    {t.p2pStop}
                  </>
                ) : (
                  <>
                    <Radio className="size-3" />
                    {t.p2pResume}
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            {t.p2pHint}
          </p>
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = '';
              void handleSelectFile(f);
            }}
          />

          {hashError && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-danger)]">
              <AlertTriangle className="size-3.5 shrink-0" />
              {t.p2pHashMismatch}
            </p>
          )}

          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={t.p2pHint}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-card-border)] px-3 text-xs font-semibold text-[var(--color-text-main)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              <FileUp className="size-3.5 shrink-0" />
              <span>{t.p2pSelectFile}</span>
            </button>
          ) : (
            <div className="space-y-2">
              {sendEnabled && (
                <p className="flex items-start gap-1.5 text-xs font-semibold text-[var(--color-success)]">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  <span>{t.p2pReadyBanner}</span>
                </p>
              )}

              {sendEnabled && (
                channel.phase === 'sending' ? (
                  <ProgressRow label={t.p2pSending} fraction={channel.progress} />
                ) : (
                  <p
                    className="flex items-center gap-1.5 text-[11px] font-medium"
                    style={{
                      color:
                        channel.phase === 'error'
                          ? 'var(--color-danger)'
                          : 'var(--color-text-muted)',
                    }}
                  >
                    {channel.phase !== 'error' && (
                      <RefreshCw className="size-3 shrink-0 animate-spin text-[var(--color-primary)]" />
                    )}
                    <span className="truncate" title={file.name}>
                      {file.name} · {p2pStatusText}
                    </span>
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Column 2 (Right): Direct Signing Share & QR */}
      <div className="flex flex-col justify-between gap-3 lg:border-l lg:border-[var(--color-card-border)]/70 lg:pl-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-warning)]">
              {t.title.replace('{count}', String(pendingCount))}
            </p>
            {signUrl && (
              <a
                href={signUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                <span>{t.openToSign}</span>
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            {t.hint}
          </p>
        </div>

        {signUrl && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <ShareTargets
              url={signUrl}
              copyLabel={t.copyLink}
              copiedLabel={t.copied}
              shareLabel={t.shareNative}
            />
            <QrPopover url={signUrl} label={t.qrLabel} hint={t.qrHint} />
          </div>
        )}
      </div>
    </div>
  );
}
