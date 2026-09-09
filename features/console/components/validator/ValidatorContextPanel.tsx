'use client';

import { Crown } from 'lucide-react';

import type { OwnedValidator } from '../../hooks/useOwnedValidators';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { AccountPicker } from '../shared/AccountPicker';
import { OptionButtons } from '../shared/OptionButtons';
import { AddressField } from '../shared/fields';

interface ValidatorContextPanelProps {
  t: ConsoleDictionary;
  account: string | null;
  onAccountChange: (account: string) => void;
  validators: OwnedValidator[];
  isLoading: boolean;
  selected: string;
  onSelect: (validator: string) => void;
  /** Set by the creation form, which runs before any validator exists. */
  hideValidator?: boolean;
  disabled?: boolean;
}

const shortAddress = (address: string) => `${address.slice(0, 14)}…${address.slice(-6)}`;

const Label = ({ children }: { children: React.ReactNode }) => (
  <span
    className="text-xs font-bold uppercase tracking-wider"
    style={{ color: 'var(--color-text-muted)' }}
  >
    {children}
  </span>
);

/**
 * Who signs and which validator the form acts on.
 *
 * Laid out as plain labelled rows inside the section that hosts it — the
 * section is the box, so nothing here draws another one. The detected-validator
 * row keeps one height across loading, empty and populated, and the address
 * field is always present once an account is chosen: anything appearing only
 * after the lookup resolved would shove the form down the page while the
 * operator was already reading it.
 */
export function ValidatorContextPanel({
  t,
  account,
  onAccountChange,
  validators,
  isLoading,
  selected,
  onSelect,
  hideValidator,
  disabled,
}: ValidatorContextPanelProps) {
  const labels = t.validator;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <Label>{labels.accountLabel}</Label>
        <AccountPicker value={account} onChange={onAccountChange} disabled={disabled} />
      </div>

      {!hideValidator && (
        <>
          <div className="flex flex-col gap-2 min-h-[56px]">
            <Label>
              <span className="inline-flex items-center gap-1.5">
                <Crown className="size-3.5" aria-hidden />
                {!account
                  ? labels.ownedMany
                  : isLoading
                    ? labels.detecting
                    : validators.length === 0
                      ? labels.noneOwned
                      : validators.length === 1
                        ? labels.ownedOne
                        : labels.ownedMany}
              </span>
            </Label>

            {isLoading ? (
              <span
                className="h-8 w-56 rounded-xl animate-pulse"
                style={{ background: 'var(--color-card-border)' }}
                aria-busy="true"
              />
            ) : !account || validators.length === 0 ? (
              <span
                className="text-[11px] leading-snug"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {account ? labels.noneOwnedHint : labels.pickAccountFirst}
              </span>
            ) : (
              <OptionButtons
                size="sm"
                disabled={disabled}
                value={selected || null}
                onChange={onSelect}
                options={validators.map((validator) => ({
                  value: validator.address,
                  label: validator.name || shortAddress(validator.address),
                  title: validator.address,
                }))}
              />
            )}
          </div>

          <AddressField
            categories={['validator']}
            label={labels.manualValidator}
            value={selected}
            onChange={onSelect}
            placeholder={t.buildManifest.fieldPlaceholders.address}
            disabled={disabled || !account}
          />
        </>
      )}
    </div>
  );
}
