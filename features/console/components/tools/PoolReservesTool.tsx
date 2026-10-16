'use client';

import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

import { usePoolFormContext } from '../../hooks/usePoolFormContext';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isPositiveDecimal, lteDecimal, normalizeDecimal } from '../../lib/decimal';
import { isDrainable } from '../../lib/pool-lookup';
import { reserveMovesManifest } from '../../lib/pool-manifests';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { OptionButtons } from '../shared/OptionButtons';
import { PoolAmountField } from '../pool/PoolAmountField';
import { PoolFormShell } from '../pool/PoolFormShell';

type Direction = 'deposit' | 'withdraw';

const fmt = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 8 });

/**
 * Moves reserves without touching the pool unit supply: a deposit makes every
 * unit worth more (fees, rewards), a withdrawal makes every unit worth less.
 * One field per pool resource, each showing what will be left as it is typed;
 * every amount goes in one transaction. Gated by the manager badge, which is
 * why that badge must never be AllowAll.
 */
export default function PoolReservesTool({ t }: ConsoleToolProps) {
  const labels = t.pool;
  const form = labels.forms.reserves;
  const ctx = usePoolFormContext();
  const { state } = ctx;
  const names = useResourceLabels(state?.resources ?? []);
  const [direction, setDirection] = useState<Direction>('deposit');
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const resources = state?.resources ?? [];
  const availableOf = (resource: string) =>
    direction === 'deposit'
      ? ctx.holdings?.fungibles.find((f) => f.resourceAddress === resource)?.amount ?? '0'
      : state?.reserves[resource] ?? '0';
  const amountOf = (resource: string) => normalizeDecimal(amounts[resource] ?? '');
  const errorOf = (resource: string) => {
    const amount = amountOf(resource);
    if (!amount) return undefined;
    if (!isPositiveDecimal(amount)) return form.amountError;
    if (!lteDecimal(amount, availableOf(resource))) return direction === 'deposit' ? form.balanceError : form.reserveError;
    return undefined;
  };
  // What will be left of the balance (deposit) or of the reserve (withdraw).
  const remainingOf = (resource: string) => {
    const amount = amountOf(resource);
    return amount && !errorOf(resource) ? fmt(Math.max(Number(availableOf(resource)) - Number(amount), 0)) : undefined;
  };

  const canManage = !!ctx.managerProof || (state ? isDrainable(state) : false);
  const blockedReason = !state ? undefined : !canManage ? form.needsManager : undefined;
  const hasError = resources.some((r) => !!errorOf(r));

  const manifest =
    ctx.account && state && !blockedReason && !hasError
      ? reserveMovesManifest({
          account: ctx.account,
          pool: state.address,
          kind: state.kind,
          direction,
          moves: resources.map((resource) => ({ resource, amount: amountOf(resource) })),
          manager: ctx.managerProof,
        })
      : '';

  return (
    <PoolFormShell
      t={t}
      ctx={ctx}
      manifest={manifest}
      title={form.title}
      hint={form.hint}
      blockedReason={blockedReason}
      sendLabel={direction === 'deposit' ? form.deposit : form.withdraw}
    >
      <div className="space-y-5">
        <OptionButtons<Direction>
          layout="grid"
          className="sm:grid-cols-2"
          size="sm"
          options={[
            { value: 'deposit', label: form.deposit, description: form.depositHint, icon: <ArrowDownToLine className="size-4" /> },
            { value: 'withdraw', label: form.withdraw, description: form.withdrawHint, icon: <ArrowUpFromLine className="size-4" /> },
          ]}
          value={direction}
          onChange={setDirection}
        />
        {resources.map((resource) => (
          <PoolAmountField
            key={resource}
            label={form.amountLabel}
            resource={resource}
            name={names[resource]}
            value={amounts[resource] ?? ''}
            onChange={(value) => setAmounts((prev) => ({ ...prev, [resource]: value }))}
            balance={availableOf(resource)}
            balanceLabel={direction === 'deposit' ? labels.balance : form.reserveBalance}
            remaining={remainingOf(resource)}
            remainingLabel={form.remainingLabel}
            maxLabel={labels.max}
            error={errorOf(resource)}
          />
        ))}
      </div>
    </PoolFormShell>
  );
}
