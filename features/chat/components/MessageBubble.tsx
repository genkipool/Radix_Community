'use client';

import { Download, FileIcon, X, XCircle } from 'lucide-react';
import { formatBytes } from '@/features/cipher/lib/format';
import { useLanguage } from '@/context/LanguageContext';
import { explorerTxUrl } from '@/features/sign/lib/explorer';
import type { ChatDictionary } from '../types/dictionary';
import type { ChatMessage } from '../types/chat.types';

// Transaction intent hashes (txid_rdx1… / txid_tdx_2_1…) in message text.
const TX_ID_RE = /(txid_[a-z0-9_]+)/gi;

/** Renders message text, turning any transaction id into a link that opens the
 *  explorer in a new tab. `split` on a capturing group puts matches at odd
 *  indices. */
function renderMessageText(text: string, language: string, sent: boolean) {
  return text.split(TX_ID_RE).map((part, i) => {
    if (i % 2 === 0) return <span key={i}>{part}</span>;
    const short = part.length > 22 ? `${part.slice(0, 14)}…${part.slice(-6)}` : part;
    return (
      <a
        key={i}
        href={explorerTxUrl(language, part)}
        target="_blank"
        rel="noopener noreferrer"
        className={`font-mono underline underline-offset-2 ${sent ? 'text-white' : ''}`}
        style={sent ? undefined : { color: 'var(--color-primary)' }}
      >
        {short}
      </a>
    );
  });
}

const timeFormat: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

/** One chat entry: gradient bubble for own messages, surface for the peer's.
 *  File attachments render as a card with progress and, once complete, a
 *  download link (the bytes only ever live in this browser). */
export function MessageBubble({
  t,
  message,
  onCancel,
}: {
  t: ChatDictionary;
  message: ChatMessage;
  /** Abort the in-flight outgoing file (only meaningful while sending). */
  onCancel?: () => void;
}) {
  const { language } = useLanguage();
  const sent = message.direction === 'sent';
  const file = message.file;
  const transferring = file?.status === 'transferring';
  const pct = file ? Math.round(file.progress * 100) : 0;
  return (
    <div className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          sent
            ? 'rounded-br-md bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] text-white'
            : 'rounded-bl-md border'
        }`}
        style={
          sent
            ? undefined
            : {
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }
        }
      >
        {file ? (
          <div className="flex min-w-48 max-w-full items-center gap-3">
            <FileIcon className={`size-8 shrink-0 ${sent ? 'text-white/90' : ''}`} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-semibold" title={file.name}>
                {file.name}
              </p>
              <p className={`text-[11px] tabular-nums ${sent ? 'text-white/70' : ''}`}
                style={sent ? undefined : { color: 'var(--color-text-muted)' }}
              >
                {formatBytes(file.size)}
                {transferring && ` · ${pct}%`}
              </p>
              {transferring && (
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{
                    background: sent
                      ? 'rgba(255,255,255,0.25)'
                      : 'var(--color-card-border)',
                  }}
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${pct}%`,
                      background: sent
                        ? 'rgba(255,255,255,0.9)'
                        : 'var(--color-primary)',
                    }}
                  />
                </div>
              )}
              {file.status === 'error' && (
                <p className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-danger,#dc2626)]">
                  <XCircle className="size-3" />
                  {t.room.fileFailed}
                </p>
              )}
              {file.status === 'canceled' && (
                <p
                  className={`flex items-center gap-1 text-[11px] font-semibold ${sent ? 'text-white/80' : ''}`}
                  style={sent ? undefined : { color: 'var(--color-text-muted)' }}
                >
                  <XCircle className="size-3" />
                  {t.room.fileCanceled}
                </p>
              )}
              {file.status === 'done' && file.url && (
                <a
                  href={file.url}
                  download={file.name}
                  className={`inline-flex items-center gap-1 text-[11px] font-bold underline-offset-2 hover:underline ${
                    sent ? 'text-white' : ''
                  }`}
                  style={sent ? undefined : { color: 'var(--color-primary)' }}
                >
                  <Download className="size-3" />
                  {t.room.download}
                </a>
              )}
            </div>
            {sent && transferring && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label={t.room.cancelSend}
                title={t.room.cancelSend}
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {renderMessageText(message.text, language, sent)}
          </p>
        )}
        <p
          className={`mt-1 text-right text-[10px] tabular-nums ${
            sent ? 'text-white/70' : ''
          }`}
          style={sent ? undefined : { color: 'var(--color-text-muted)' }}
        >
          {new Date(message.at).toLocaleTimeString([], timeFormat)}
        </p>
      </div>
    </div>
  );
}
