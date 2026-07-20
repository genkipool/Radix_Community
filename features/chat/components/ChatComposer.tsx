'use client';

import { useState, type KeyboardEvent } from 'react';
import { SendHorizontal } from 'lucide-react';
import { MAX_MESSAGE_CHARS } from '../constants/chat';
import type { ChatDictionary } from '../types/dictionary';

/** Message input: Enter sends, Shift+Enter breaks the line. */
export function ChatComposer({
  t,
  disabled,
  onSend,
}: {
  t: ChatDictionary;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t.room.placeholder}
        disabled={disabled}
        rows={1}
        maxLength={MAX_MESSAGE_CHARS}
        className="max-h-32 min-h-[2.75rem] flex-1 resize-y rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)] disabled:opacity-50"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-card-border)',
          color: 'var(--color-text-main)',
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !draft.trim()}
        aria-label={t.room.send}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
      >
        <SendHorizontal className="size-4" />
      </button>
    </div>
  );
}
