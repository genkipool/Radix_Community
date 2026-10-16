'use client';

import { useState } from 'react';

import { usePoolFormContext } from '../../hooks/usePoolFormContext';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isPositiveDecimal, lteDecimal, normalizeDecimal } from '../../lib/decimal';
import { isDrainable } from '../../lib/pool-lookup';
import { contributeManifest } from '../../lib/pool-manifests';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { PoolAmountField } from '../pool/PoolAmountField';
import { PoolFormShell } from '../pool/PoolFormShell';

/**
 * Adds liquidity to a pool and receives pool units. The engine takes the
 * reserves in the pool's current ratio and returns what does not fit, so the
 * change comes back with the units. Gated by the manager badge.
 */
export default function PoolContributeTool({ t }: ConsoleToolProps) {
  const labels = t.pool;
  const form = labels.forms.contribute;
  const ctx = usePoolFormContext();
  const { state } = ctx;
  const names = useResourceLabels(state?.resources ?? []);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const balanceOf = (resource: string) =>
    ctx.holdings?.fungibles.find((f) => f.resourceAddress === resource)?.amount ?? '0';

  const resources = state?.resources ?? [];
  const entries = resources.map((resource) => ({ resource, amount: normalizeDecimal(amounts[resource] ?? '') }));
  const errorOf = (resource: string, amount: string) =>
    !amount ? undefined : !isPositiveDecimal(amount) ? form.amountError : !lteDecimal(amount, balanceOf(resource)) ? form.balanceError : undefined;

  const allValid = entries.length > 0 && entries.every((e) => e.amount && !errorOf(e.resource, e.amount));
  const canManage = !!ctx.managerProof || (state ? isDrainable(state) : false);

  const blockedReason = !state
    ? undefined
    : !canManage
      ? form.needsManager
      : undefined;

  const manifest =
    ctx.account && state && allValid && !blockedReason
      ? contributeManifest({
          account: ctx.account,
          pool: state.address,
          kind: state.kind,
          contributions: entries,
          manager: ctx.managerProof,
        })
      : '';

  return (
    <PoolFormShell t={t} ctx={ctx} manifest={manifest} title={form.title} hint={form.hint} blockedReason={blockedReason} sendLabel={form.sendButton}>
      <div className="space-y-4">
        {resources.map((resource) => (
          <PoolAmountField
            key={resource}
            label={form.amountLabel}
            resource={resource}
            name={names[resource]}
            value={amounts[resource] ?? ''}
            onChange={(value) => setAmounts((prev) => ({ ...prev, [resource]: value }))}
            balance={balanceOf(resource)}
            balanceLabel={labels.balance}
            maxLabel={labels.max}
            error={errorOf(resource, normalizeDecimal(amounts[resource] ?? ''))}
          />
        ))}
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {form.ratioNote}
        </p>
      </div>
    </PoolFormShell>
  );
}
