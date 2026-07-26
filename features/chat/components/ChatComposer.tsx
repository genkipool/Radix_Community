'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Paperclip, SendHorizontal } from 'lucide-react';
import { MAX_MESSAGE_CHARS } from '../constants/chat';
import type { ChatDictionary } from '../types/dictionary';

/** Silence after the last keystroke before the peer's dots are cleared. */
const TYPING_IDLE_MS = 2_000;

/** Message input: Enter sends, Shift+Enter breaks the line. The paperclip
 *  attaches any file (no size limit: transfers stream with flat memory),
 *  encrypted over the same channel. */
export function ChatComposer({
  t,
  disabled,
  sendingFile,
  onSend,
  onSendFile,
  onTyping,
}: {
  t: ChatDictionary;
  disabled: boolean;
  /** An outgoing file is in flight (one at a time). */
  sendingFile: boolean;
  onSend: (text: string) => void;
  onSendFile: (file: File) => void;
  /** Mirrors composing state to the peer (rate-limited by the session). */
  onTyping: (typing: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The handler is recreated every render (this repo bans useCallback), so the
  // unmount cleanup reads it through a ref instead of depending on it.
  const onTypingRef = useRef(onTyping);
  useEffect(() => {
    onTypingRef.current = onTyping;
  });

  // Never leave the peer staring at dots because this side went away.
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      onTypingRef.current(false);
    };
  }, []);

  const stopTyping = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
    onTyping(false);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (disabled) return;
    if (!value.trim()) {
      stopTyping();
      return;
    }
    onTyping(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft('');
    stopTyping();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const onPickFile = (file: File | null) => {
    if (!file || disabled) return;
    onSendFile(file);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            onPickFile(event.target.files?.[0] ?? null);
            // Allow re-selecting the same file later.
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sendingFile}
          aria-label={t.room.attach}
          title={t.room.attach}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
          style={{
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          <Paperclip className="size-4" />
        </button>
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={stopTyping}
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
    </div>
  );
}
