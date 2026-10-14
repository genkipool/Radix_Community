'use client';

import { useId, type CSSProperties } from 'react';
import { Braces, ChevronDown } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';

type JsonTokenType = 'key' | 'string' | 'number' | 'literal' | 'punct' | 'plain';

const TOKEN_RE = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;

const TOKEN_STYLES: Record<JsonTokenType, CSSProperties> = {
  key: { color: 'var(--code-keyword)', fontWeight: 600 },
  string: { color: 'var(--code-string)' },
  number: { color: 'var(--code-type)' },
  literal: { color: 'var(--code-type)', fontWeight: 600 },
  punct: { color: 'var(--code-punct)', opacity: 0.7 },
  plain: { color: 'var(--color-text-main)' },
};

function tokenizeJson(code: string): Array<{ type: JsonTokenType; text: string }> {
  const tokens: Array<{ type: JsonTokenType; text: string }> = [];
  let last = 0;
  for (const match of code.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ type: 'plain', text: code.slice(last, index) });
    const [, str, colon, num, literal, punct] = match;
    if (str !== undefined) {
      tokens.push({ type: colon ? 'key' : 'string', text: str });
      if (colon) tokens.push({ type: 'punct', text: colon });
    } else if (num !== undefined) tokens.push({ type: 'number', text: num });
    else if (literal !== undefined) tokens.push({ type: 'literal', text: literal });
    else if (punct !== undefined) tokens.push({ type: 'punct', text: punct });
    last = index + match[0].length;
  }
  if (last < code.length) tokens.push({ type: 'plain', text: code.slice(last) });
  return tokens;
}

/** Read-only, theme-aware syntax-highlighted JSON. */
export function JsonCode({ code }: { code: string }) {
  return (
    <pre className="m-0 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all">
      <code>
        {tokenizeJson(code).map((token, i) => (
          <span key={i} style={TOKEN_STYLES[token.type]}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}

interface JsonFileButtonProps {
  name: string;
  hint: string;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  controls: string;
}

/** A text button named after the file ("request.json") that reveals its JSON. */
export function JsonFileButton({ name, hint, open, disabled, onToggle, controls }: JsonFileButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-expanded={open}
      aria-controls={controls}
      title={hint}
      className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold transition-colors hover:text-[var(--color-accent)] disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
      style={{ color: open ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
    >
      <Braces className="size-3.5" />
      {name}
      <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

interface JsonPanelProps {
  id: string;
  name: string;
  json: string;
  note?: string;
  copyLabel: string;
}

/** The revealed contents of a JSON file: no box, a ruled header and the code. */
export function JsonPanel({ id, name, json, note, copyLabel }: JsonPanelProps) {
  const headingId = useId();
  const border = { borderColor: 'var(--color-card-border)' };
  return (
    <section id={id} aria-labelledby={headingId} className="border-b pb-3" style={border}>
      <header className="flex items-center justify-between gap-3 border-b pb-2" style={border}>
        <div className="min-w-0">
          <span id={headingId} className="font-mono text-[11px] font-semibold" style={{ color: 'var(--color-text-main)' }}>
            {name}
          </span>
          {note && (
            <span className="ml-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {note}
            </span>
          )}
        </div>
        <CopyButton value={json} size="xs" variant="minimal" label={copyLabel} />
      </header>
      <div className="max-h-[420px] overflow-auto pt-3">
        <JsonCode code={json} />
      </div>
    </section>
  );
}
