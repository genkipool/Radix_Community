'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MANIFEST_TOKEN_STYLES,
  manifestCompletions,
  tokenizeManifest,
} from '../../lib/manifest-syntax';

/* Identical metrics for the highlight layer, the textarea and the caret mirror */
const METRICS_CLASS = 'font-mono text-xs leading-relaxed whitespace-pre-wrap break-words p-4';

interface ManifestEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Minimum visible rows */
  rows?: number;
  ariaLabel?: string;
}

interface SuggestState {
  items: string[];
  selected: number;
  /** Word being completed (immediately before the caret) */
  word: string;
  caret: number;
}

const CLOSED: SuggestState = { items: [], selected: 0, word: '', caret: 0 };

/**
 * Transaction-manifest editor: transparent textarea over a syntax-highlighted
 * layer (theme `--code-*` palette) with keyword autocompletion.
 */
export function ManifestEditor({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 14,
  ariaLabel,
}: ManifestEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const [suggest, setSuggest] = useState<SuggestState>(CLOSED);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const isOpen = suggest.items.length > 0;

  /* Position the dropdown under the caret once the mirror has rendered */
  useEffect(() => {
    if (!isOpen || !markerRef.current) {
      setDropdownPos(null);
      return;
    }
    const marker = markerRef.current;
    setDropdownPos({ top: marker.offsetTop + marker.offsetHeight + 4, left: marker.offsetLeft });
  }, [isOpen, suggest.caret]);

  const updateSuggestions = (text: string, caret: number) => {
    const wordMatch = text.slice(0, caret).match(/[A-Za-z_][A-Za-z0-9_]*$/);
    const word = wordMatch?.[0] ?? '';
    const items = manifestCompletions(word);
    setSuggest(items.length > 0 ? { items, selected: 0, word, caret } : CLOSED);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    updateSuggestions(e.target.value, e.target.selectionStart);
  };

  const accept = (candidate: string) => {
    const before = value.slice(0, suggest.caret - suggest.word.length);
    const after = value.slice(suggest.caret);
    onChange(before + candidate + after);
    setSuggest(CLOSED);
    const caret = before.length + candidate.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setSuggest((prev) => ({
        ...prev,
        selected: (prev.selected + delta + prev.items.length) % prev.items.length,
      }));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      accept(suggest.items[suggest.selected]);
    } else if (e.key === 'Escape') {
      setSuggest(CLOSED);
    }
  };

  const minHeight = `calc(${rows} * 1.625 * 0.75rem + 2rem)`;

  return (
    <div
      className="relative rounded-xl border transition-colors focus-within:border-[var(--color-primary)]"
      style={{ background: 'var(--code-bg)', borderColor: 'var(--color-card-border)' }}
    >
      {/* Highlight layer — defines the height of the editor */}
      <pre aria-hidden className={`m-0 pointer-events-none ${METRICS_CLASS}`} style={{ minHeight }}>
        <code>
          {tokenizeManifest(value).map((token, index) => (
            <span key={index} style={MANIFEST_TOKEN_STYLES[token.type]}>
              {token.text}
            </span>
          ))}
          {'\n'}
        </code>
      </pre>

      {/* Caret mirror — used only to measure the dropdown anchor */}
      {isOpen && (
        <div aria-hidden className={`absolute inset-0 invisible overflow-hidden ${METRICS_CLASS}`}>
          {value.slice(0, suggest.caret)}
          <span ref={markerRef} />
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={() => setSuggest(CLOSED)}
        onBlur={() => setSuggest(CLOSED)}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-label={ariaLabel}
        className={`absolute inset-0 w-full h-full bg-transparent resize-none outline-none overflow-hidden disabled:opacity-50 ${METRICS_CLASS}`}
        style={{
          color: 'transparent',
          caretColor: 'var(--color-text-main)',
          // Placeholder must stay visible even though the text is transparent
          WebkitTextFillColor: value ? 'transparent' : undefined,
        }}
      />

      {/* Autocomplete dropdown */}
      {isOpen && dropdownPos && (
        <ul
          role="listbox"
          className="absolute z-20 min-w-44 max-h-56 overflow-y-auto rounded-xl border shadow-xl py-1"
          style={{
            top: dropdownPos.top,
            left: Math.min(dropdownPos.left, 9999),
            background: 'var(--color-card-bg)',
            borderColor: 'var(--color-card-border)',
          }}
        >
          {suggest.items.map((item, index) => (
            <li key={item} role="option" aria-selected={index === suggest.selected}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(item);
                }}
                onMouseEnter={() => setSuggest((prev) => ({ ...prev, selected: index }))}
                className="w-full text-left px-3 py-1.5 font-mono text-xs cursor-pointer"
                style={{
                  background: index === suggest.selected ? 'rgba(var(--color-primary-rgb), 0.12)' : 'transparent',
                  color: index === suggest.selected ? 'var(--color-primary)' : 'var(--color-text-main)',
                }}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
