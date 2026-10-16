'use client';

import { truncateAddress } from '@/utils/formatters';
import { TextField } from '../shared/fields';

interface PoolAmountFieldProps {
  label: string;
  resource: string;
  /** Symbol or name, when known. */
  name?: string;
  value: string;
  onChange: (value: string) => void;
  /** What the account holds of it, shown with a "max" shortcut. */
  balance?: string;
  balanceLabel: string;
  /** What will be left once this amount moves, shown beside the balance as it is typed. */
  remaining?: string;
  remainingLabel?: string;
  maxLabel: string;
  error?: string;
  disabled?: boolean;
}

/** An amount of one resource, with the balance (and what will be left) and a max shortcut. */
export function PoolAmountField({
  label,
  resource,
  name,
  value,
  onChange,
  balance,
  balanceLabel,
  remaining,
  remainingLabel,
  maxLabel,
  error,
  disabled,
}: PoolAmountFieldProps) {
  const balanceText = balanceLabel.replace('{amount}', balance ?? '0');
  return (
    <TextField
      label={`${label} · ${name || truncateAddress(resource, 10, 6)}`}
      value={value}
      onChange={onChange}
      placeholder="0"
      error={error}
      disabled={disabled}
      hint={remaining !== undefined && remainingLabel ? `${balanceText} · ${remainingLabel.replace('{amount}', remaining)}` : balanceText}
      trailing={
        balance && Number(balance) > 0 ? (
          <button
            type="button"
            onClick={() => onChange(balance)}
            disabled={disabled}
            className="text-[11px] font-bold px-2 py-1 rounded-lg cursor-pointer hover:opacity-70"
            style={{ color: 'var(--color-primary)' }}
          >
            {maxLabel}
          </button>
        ) : undefined
      }
    />
  );
}
