import type { ReactNode } from 'react';

import { OptionButtons } from './OptionButtons';
import type { AuthRoleValue } from '../../lib/access-rules';

export function AuthRoleRow<T extends string = AuthRoleValue>({
  roleKey,
  roleHint,
  value,
  onChange,
  options,
  labels,
  optionHints,
  disabled,
  readOnly,
  detail,
}: {
  roleKey: string;
  roleHint?: string;
  value: T;
  onChange?: (value: T) => void;
  options: T[];
  labels: Record<string, string>;
  optionHints: Record<string, string>;
  disabled?: boolean;
  readOnly?: boolean;
  /** Lines above the options: who the chosen option is (a badge, an address), whether it can change. */
  detail?: ReactNode;
}) {
  const buttons = (
    <OptionButtons<T>
      options={options.map((opt) => ({ value: opt, label: labels[opt] || opt, title: optionHints[opt] }))}
      value={value}
      onChange={onChange || ((() => {}) as unknown as (value: T) => void)}
      size="sm"
      disabled={disabled || readOnly}
      className={`flex-1 ${readOnly ? 'opacity-80' : ''}`}
    />
  );
  if (detail) {
    // Who the role belongs to reads first, then the options; the key lines up with that first line.
    return (
      <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3 py-1.5">
        <code
          className="text-xs leading-5 sm:w-64 shrink-0 cursor-help"
          style={{ color: 'var(--color-text-muted)' }}
          title={roleHint}
        >
          {roleKey}
        </code>
        <div className="flex flex-1 min-w-0 flex-col gap-1.5">
          <div className="flex flex-col gap-0.5">{detail}</div>
          {buttons}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-1.5">
      <code
        className="text-xs sm:w-64 shrink-0 cursor-help"
        style={{ color: 'var(--color-text-muted)' }}
        title={roleHint}
      >
        {roleKey}
      </code>
      {buttons}
    </div>
  );
}
