'use client';

import { useState } from 'react';

import { usePoolFormContext } from '../../hooks/usePoolFormContext';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isPositiveDecimal, lteDecimal, normalizeDecimal } from '../../lib/decimal';
import { redemptionValue } from '../../lib/pool-lookup';
import { redeemManifest } from '../../lib/pool-manifests';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { PoolAmountField } from '../pool/PoolAmountField';
import { PoolFormShell } from '../pool/PoolFormShell';

/**
 * Burns pool units for their share of the reserves. Public: any holder can
 * redeem, no badge involved, which is also how the owner of a drainable pool
 * gets their liquidity out.
 */
export default function PoolRedeemTool({ t }: ConsoleToolProps) {
  const labels = t.pool;
  const form = labels.forms.redeem;
  const ctx = usePoolFormContext();
  const { state } = ctx;
  const names = useResourceLabels(state ? [...state.resources, state.poolUnit] : []);
  const [rawAmount, setAmount] = useState('');

  const amount = normalizeDecimal(rawAmount);
  const held = String(ctx.heldUnits);
  const amountError = !amount
    ? undefined
    : !isPositiveDecimal(amount)
      ? form.amountError
      : !lteDecimal(amount, held)
        ? form.balanceError
        : undefined;

  const blockedReason = !state ? undefined : ctx.heldUnits <= 0 ? form.noUnits : undefined;

  const manifest =
    ctx.account && state && amount && !amountError && !blockedReason
      ? redeemManifest({ account: ctx.account, pool: state.address, poolUnit: state.poolUnit, amount })
      : '';

  // Before, redeemed and after: the units and what they are worth in each reserve.
  const supply = ctx.poolUnitSupply ?? 0;
  const redeeming = isPositiveDecimal(amount) && !amountError ? Number(amount) : 0;
  const columns =
    state && supply > 0 && ctx.heldUnits > 0
      ? [
          { label: form.totalLabel, units: ctx.heldUnits },
          { label: form.redeemingLabel, units: redeeming },
          { label: form.remainingLabel, units: Math.max(ctx.heldUnits - redeeming, 0) },
        ]
      : [];
  const unitName = state ? names[state.poolUnit] ?? labels.poolUnitLabel : '';
  const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 8 });

  return (
    <PoolFormShell t={t} ctx={ctx} manifest={manifest} title={form.title} hint={form.hint} blockedReason={blockedReason} sendLabel={form.sendButton}>
      {state && (
        <div className="space-y-4">
          <PoolAmountField
            label={form.amountLabel}
            resource={state.poolUnit}
            name={names[state.poolUnit] ?? labels.poolUnitLabel}
            value={rawAmount}
            onChange={setAmount}
            balance={held}
            balanceLabel={labels.balance}
            maxLabel={labels.max}
            error={amountError}
          />
          {columns.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {columns.map((column, i) => (
                  <div
                    key={column.label}
                    className={`rounded-xl p-3 ${i === 1 ? 'border-2' : 'border'}`}
                    style={{ borderColor: i === 1 ? 'var(--color-primary)' : 'var(--color-card-border)' }}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      {column.label}
                    </span>
                    <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                      {fmt(column.units)} {unitName}
                    </p>
                    {Object.entries(redemptionValue(state!.reserves, column.units, supply)).map(([resource, value]) => (
                      <p key={resource} className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }} title={resource}>
                        ≈ {fmt(value)} {names[resource] ?? resource.slice(0, 18)}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {form.estimateNote}
              </p>
            </div>
          )}
        </div>
      )}
    </PoolFormShell>
  );
}
