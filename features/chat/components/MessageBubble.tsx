'use client';

import type { ChatMessage } from '../types/chat.types';

const timeFormat: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

/** One chat entry: gradient bubble for own messages, surface for the peer's. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const sent = message.direction === 'sent';
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
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.text}
        </p>
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
