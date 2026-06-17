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
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-1.5">
      <code
        className="text-xs sm:w-64 shrink-0 cursor-help"
        style={{ color: 'var(--color-text-muted)' }}
        title={roleHint}
      >
        {roleKey}
      </code>
      <OptionButtons<T>
        options={options.map((opt) => ({ value: opt, label: labels[opt] || opt, title: optionHints[opt] }))}
        value={value}
        onChange={onChange || ((() => {}) as unknown as (value: T) => void)}
        size="sm"
        disabled={disabled || readOnly}
        className={`flex-1 ${readOnly ? 'opacity-80' : ''}`}
      />
    </div>
  );
}
