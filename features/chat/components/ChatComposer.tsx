'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Paperclip, SendHorizontal } from 'lucide-react';
import { MAX_MESSAGE_CHARS } from '../constants/chat';
import type { ChatDictionary } from '../types/dictionary';

/** Message input: Enter sends, Shift+Enter breaks the line. The paperclip
 *  attaches any file (no size limit: transfers stream with flat memory),
 *  encrypted over the same channel. */
export function ChatComposer({
  t,
  disabled,
  sendingFile,
  onSend,
  onSendFile,
}: {
  t: ChatDictionary;
  disabled: boolean;
  /** An outgoing file is in flight (one at a time). */
  sendingFile: boolean;
  onSend: (text: string) => void;
  onSendFile: (file: File) => void;
}) {
  const [draft, setDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
}
