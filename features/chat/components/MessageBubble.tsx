'use client';

import { Download, FileIcon, XCircle } from 'lucide-react';
import { formatBytes } from '@/features/cipher/lib/format';
import type { ChatDictionary } from '../types/dictionary';
import type { ChatMessage } from '../types/chat.types';

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
}: {
  t: ChatDictionary;
  message: ChatMessage;
}) {
  const sent = message.direction === 'sent';
  const file = message.file;
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
          <div className="flex min-w-48 items-center gap-3">
            <FileIcon className={`size-8 shrink-0 ${sent ? 'text-white/90' : ''}`} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-semibold" title={file.name}>
                {file.name}
              </p>
              <p className={`text-[11px] ${sent ? 'text-white/70' : ''}`}
                style={sent ? undefined : { color: 'var(--color-text-muted)' }}
              >
                {formatBytes(file.size)}
              </p>
              {file.status === 'transferring' && (
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
                      width: `${Math.round(file.progress * 100)}%`,
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
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.text}
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
