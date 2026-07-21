'use client';

import { useEffect, useRef } from 'react';
import { BadgeCheck, LogOut, ShieldCheck } from 'lucide-react';
import { shortAddress } from '@/utils/format';
import type { ChatDictionary } from '../types/dictionary';
import type { ChatMessage, VerifiedPeer } from '../types/chat.types';
import { ChatComposer } from './ChatComposer';
import { MessageBubble } from './MessageBubble';

/** The secure room: verified-identity header, message log and composer. */
export function ChatRoom({
  t,
  peer,
  messages,
  closed,
  sendingFile,
  onSend,
  onSendFile,
  onLeave,
}: {
  t: ChatDictionary;
  peer: VerifiedPeer;
  messages: ChatMessage[];
  /** The other side left; the log stays readable but input is disabled. */
  closed: boolean;
  /** An outgoing file is in flight (attach is disabled meanwhile). */
  sendingFile: boolean;
  onSend: (text: string) => void;
  onSendFile: (file: File) => void;
  onLeave: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  return (
    <div
      className="flex flex-col rounded-3xl border overflow-hidden"
      style={{
        background: 'var(--color-card-bg)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <header
        className="flex items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
            <ShieldCheck className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {t.room.securedWith}
            </p>
            <p
              className="flex items-center gap-1.5 truncate font-mono text-sm font-bold"
              style={{ color: 'var(--color-text-main)' }}
              title={peer.account}
            >
              {shortAddress(peer.account)}
              <span
                className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  background: 'rgba(var(--color-primary-rgb), 0.1)',
                  color: 'var(--color-primary)',
                }}
              >
                <BadgeCheck className="size-3" />
                {t.room.verified}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut className="size-3.5" />
          {t.room.leave}
        </button>
      </header>

      <div className="flex h-[clamp(20rem,60vh,48rem)] flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p
            className="m-auto text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t.room.empty}
          </p>
        )}
        {messages.map((message: ChatMessage) => (
          <MessageBubble key={message.id} t={t} message={message} />
        ))}
        <div ref={endRef} />
      </div>

      <footer
        className="border-t px-5 py-4"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        {closed ? (
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {t.room.closedBanner}
          </p>
        ) : (
          <ChatComposer
            t={t}
            disabled={closed}
            sendingFile={sendingFile}
            onSend={onSend}
            onSendFile={onSendFile}
          />
        )}
      </footer>
    </div>
  );
}
