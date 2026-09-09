'use client';

import { Check, Crown, Plus, X } from 'lucide-react';

import type { ValidatorFormContext } from '../../hooks/useValidatorFormContext';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { AccountPicker } from '../shared/AccountPicker';
import { AddressField } from '../shared/fields';

interface ValidatorContextPanelProps {
  t: ConsoleDictionary;
  ctx: ValidatorFormContext;
  /** Set by the creation form, which runs before any validator exists. */
  hideValidator?: boolean;
  disabled?: boolean;
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <span
    className="text-xs font-bold uppercase tracking-wider"
    style={{ color: 'var(--color-text-muted)' }}
  >
    {children}
  </span>
);

/**
 * Who signs, and which validators the form acts on.
 *
 * Several at once: the ledger lets one badge proof cover every owner call in a
 * transaction, so acting on four validators costs one transaction and one
 * proof. Every validator the account owns is listed and switched on from the
 * start; untick the ones to leave out, and add addresses the account does not
 * own a badge for with the button below.
 */
export function ValidatorContextPanel({
  t,
  ctx,
  hideValidator,
  disabled,
}: ValidatorContextPanelProps) {
  const labels = t.validator;
  const { rows, account, isLoadingValidators } = ctx;
  const detectedCount = rows.filter((row) => row.detected).length;
  const selectedCount = ctx.validators.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <Label>{labels.accountLabel}</Label>
        <AccountPicker value={account} onChange={ctx.setAccount} disabled={disabled} />
      </div>

      {!hideValidator && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <Label>
              <span className="inline-flex items-center gap-1.5">
                <Crown className="size-3.5" aria-hidden />
                {!account
                  ? labels.ownedMany
                  : isLoadingValidators
                    ? labels.detecting
                    : detectedCount === 0
                      ? labels.noneOwned
                      : detectedCount === 1
                        ? labels.ownedOne
                        : labels.ownedMany}
              </span>
            </Label>
            {selectedCount > 0 && (
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {labels.selectedCount.replace('{count}', String(selectedCount))}
              </span>
            )}
          </div>

          {isLoadingValidators ? (
            <span
              className="h-11 rounded-xl animate-pulse"
              style={{ background: 'var(--color-card-border)' }}
              aria-busy="true"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div key={row.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={row.selected}
                    aria-label={row.name || row.address || labels.manualValidator}
                    onClick={() => ctx.toggleRow(row.id)}
                    disabled={disabled || !row.address.trim()}
                    className="shrink-0 mt-[13px] size-[18px] rounded-md border grid place-items-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: row.selected && row.address.trim() ? 'var(--color-primary)' : 'transparent',
                      borderColor:
                        row.selected && row.address.trim()
                          ? 'var(--color-primary)'
                          : 'var(--color-card-border)',
                    }}
                  >
                    {row.selected && row.address.trim() && <Check className="size-3 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <AddressField
                      categories={['validator']}
                      label={row.detected ? row.name || labels.detectedValidator : undefined}
                      value={row.address}
                      onChange={(address) => ctx.setRowAddress(row.id, address)}
                      placeholder={t.buildManifest.fieldPlaceholders.address}
                      disabled={disabled || !account}
                    />
                  </div>

                  {!row.detected && rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => ctx.removeRow(row.id)}
                      disabled={disabled}
                      aria-label={labels.removeValidator}
                      title={labels.removeValidator}
                      className="shrink-0 mt-[9px] size-7 grid place-items-center rounded-lg transition-opacity cursor-pointer hover:opacity-70 disabled:opacity-25"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={ctx.addRow}
            disabled={disabled || !account}
            className="self-start inline-flex items-center gap-1.5 text-xs font-bold transition-opacity cursor-pointer hover:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'var(--color-primary)' }}
          >
            <Plus className="size-3.5" aria-hidden />
            {labels.addValidator}
          </button>

          {account && !isLoadingValidators && detectedCount === 0 && (
            <span className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              {labels.noneOwnedHint}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
