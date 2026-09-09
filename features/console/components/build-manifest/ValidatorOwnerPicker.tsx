'use client';

import { useEffect, useRef } from 'react';
import { Crown } from 'lucide-react';

import { useOwnedValidators, type OwnedValidator } from '../../hooks/useOwnedValidators';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { OptionButtons } from '../shared/OptionButtons';

interface ValidatorOwnerPickerProps {
  t: ConsoleDictionary;
  /** Account whose validator owner badges are looked up. */
  accountAddress: string;
  /** Validator address currently held by the template's fields. */
  selectedValidator: string;
  /** Applies a validator to the template: address and badge id together. */
  onSelect: (validator: OwnedValidator) => void;
  disabled?: boolean;
}

const shortAddress = (address: string) => `${address.slice(0, 12)}…${address.slice(-6)}`;

/**
 * Turns the owner-gated templates into a pick-from-a-list flow: the operator
 * chooses one of their own validators and both the address and the badge id
 * are filled in.
 *
 * The box keeps one height across loading, empty and populated. Rendering
 * nothing until the lookup resolves would shove the fields below it down the
 * page at the moment the operator is already reading them.
 */
export function ValidatorOwnerPicker({
  t,
  accountAddress,
  selectedValidator,
  onSelect,
  disabled,
}: ValidatorOwnerPickerProps) {
  const labels = t.buildManifest.validatorOwner;
  const { data: validators, isLoading } = useOwnedValidators(accountAddress);

  /*
   * Autofilling is a one-shot courtesy per account, not a binding: re-running
   * it on every render would fight the operator the moment they edit a field
   * or pick a second validator by hand.
   */
  const autofilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!validators?.length || autofilledFor.current === accountAddress) return;
    autofilledFor.current = accountAddress;
    if (!selectedValidator) onSelect(validators[0]);
  }, [validators, accountAddress, selectedValidator, onSelect]);

  const title = isLoading
    ? labels.detecting
    : !validators?.length
      ? labels.detectedNone
      : validators.length === 1
        ? labels.detectedOne
        : labels.detectedMany;

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-2xl border min-h-[84px] justify-center"
      style={{
        background: 'rgba(var(--color-primary-rgb), 0.06)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <span
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Crown className="size-3.5" aria-hidden />
        {title}
      </span>

      {isLoading ? (
        <span
          className="h-8 w-56 rounded-xl animate-pulse"
          style={{ background: 'var(--color-card-border)' }}
          aria-busy="true"
        />
      ) : !validators?.length ? (
        <span className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
          {labels.hintNone}
        </span>
      ) : (
        <>
          <OptionButtons
            size="sm"
            disabled={disabled}
            value={selectedValidator || null}
            onChange={(address) => {
              const picked = validators.find((validator) => validator.address === address);
              if (picked) onSelect(picked);
            }}
            options={validators.map((validator) => ({
              value: validator.address,
              label: validator.name || shortAddress(validator.address),
              title: validator.address,
            }))}
          />
          <span className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            {labels.hint}
          </span>
        </>
      )}
    </div>
  );
}
