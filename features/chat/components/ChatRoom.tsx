'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  onCancelFile,
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
  /** Abort the file currently being sent. */
  onCancelFile: () => void;
  onLeave: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  // Exact pixel height that fits below whatever chrome sits above the card
  // (navbar + tool header), so the whole chat is visible without page scroll on
  // any resolution. Measured, not guessed, because the header height varies.
  const [deskHeight, setDeskHeight] = useState<number | null>(null);

  // On phones the chat takes over the whole screen (immersive); leaving the
  // room (closed) drops back to the normal in-page layout.
  const fullscreen = isMobile && !closed;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useLayoutEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const measure = () => {
      setIsMobile(mobileQuery.matches);
      const el = cardRef.current;
      if (!el || mobileQuery.matches) {
        setDeskHeight(null);
        return;
      }
      // Distance from the viewport top to the card, minus a bottom gap that
      // also covers the page's own bottom padding.
      const top = el.getBoundingClientRect().top;
      setDeskHeight(Math.max(320, window.innerHeight - top - 48));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Lock the background while the phone chat is fullscreen so it can't scroll
  // behind the overlay; restored on leave/unmount.
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  const height = fullscreen
    ? '100dvh'
    : isMobile
      ? '70dvh'
      : deskHeight != null
        ? `${deskHeight}px`
        : 'calc(100dvh - 17rem)';

  return (
    <div
      ref={cardRef}
      className={`flex flex-col overflow-hidden ${
        fullscreen
          ? 'fixed inset-0 z-[100] border-0'
          : 'relative rounded-3xl border'
      }`}
      style={{
        height,
        minHeight: fullscreen ? undefined : '20rem',
        background: 'var(--color-card-bg)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4"
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p
            className="m-auto text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t.room.empty}
          </p>
        )}
        {messages.map((message: ChatMessage) => (
          <MessageBubble
            key={message.id}
            t={t}
            message={message}
            onCancel={onCancelFile}
          />
        ))}
        <div ref={endRef} />
      </div>

      <footer
        className="shrink-0 border-t px-5 py-4"
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
