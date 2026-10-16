'use client';

import type { ReactNode } from 'react';

import { truncateAddress } from '@/utils/formatters';
import type { PoolFormContext } from '../../hooks/usePoolFormContext';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isDrainable, type PoolRule } from '../../lib/pool-lookup';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { AccountPicker } from '../shared/AccountPicker';
import { RuleSummary, Sub, badgeNamer } from '../shared/InfoParts';
import { RoleBadges } from '../shared/RoleBadges';
import { OptionButtons } from '../shared/OptionButtons';
import { AddressField } from '../shared/fields';

interface PoolContextPanelProps {
  t: ConsoleDictionary;
  ctx: PoolFormContext;
  /** Set by the creation form, which runs before the pool exists. */
  hidePool?: boolean;
  disabled?: boolean;
}

const Label = ({ children }: { children: ReactNode }) => (
  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
    {children}
  </span>
);

/** One fact about the pool: a muted label on the left, the value on the right. */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:gap-4">
    <span className="text-xs shrink-0 sm:w-36 sm:pt-0.5" style={{ color: 'var(--color-text-muted)' }}>
      {label}
    </span>
    <div className="min-w-0 flex-1 text-sm" style={{ color: 'var(--color-text-main)' }}>
      {children}
    </div>
  </div>
);

/** Amounts with thousands separators and at most four decimals; the exact figure is in the tooltip. */
const amount = (value: string | number) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: Number(value) >= 1 ? 4 : 8 });

/**
 * Who signs, which pool, and the pool as the ledger has it: its reserves, its
 * pool unit and, above all, who can manage it. A pool whose manager rule is
 * AllowAll is flagged loudly: anyone can empty it.
 */
export function PoolContextPanel({ t, ctx, hidePool, disabled }: PoolContextPanelProps) {
  const labels = t.pool;
  const { state } = ctx;
  const badgeResources = state
    ? [state.manager, state.owner].flatMap((r) => (r.type === 'resource' || r.type === 'nonFungible' ? [r.resource] : []))
    : [];
  const names = useResourceLabels(state ? [...state.resources, state.poolUnit, ...badgeResources] : []);

  const ruleView = (rule: PoolRule, proof: unknown, note?: string) => (
    <RuleSummary t={t} rule={rule} badgeName={badgeNamer(names)} held={!!proof} note={note} />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <Label>{labels.accountLabel}</Label>
        <AccountPicker value={ctx.account} onChange={ctx.setAccount} disabled={disabled} />
      </div>

      {!hidePool && (
        <div className="flex flex-col gap-3">
          <Label>{labels.poolLabel}</Label>
          {ctx.detected.length > 0 && (
            <OptionButtons
              layout="grid"
              className="sm:grid-cols-2"
              size="sm"
              options={ctx.detected.map((p) => ({
                value: p.address,
                label: p.name || truncateAddress(p.address, 10, 6),
                description: labels.unitsHeld.replace('{amount}', p.units),
                title: p.address,
              }))}
              value={ctx.detected.some((p) => p.address === ctx.pool) ? ctx.pool : null}
              onChange={ctx.setPool}
              disabled={disabled}
            />
          )}
          <AddressField
            categories={['pool']}
            value={ctx.pool}
            onChange={ctx.setPool}
            placeholder={labels.poolPlaceholder}
            hint={ctx.detected.length === 0 && ctx.account ? labels.noneDetected : undefined}
            error={!ctx.isLoadingState && ctx.pool.startsWith('pool_') && state === null ? labels.notAPool : undefined}
            reserveMessage
            disabled={disabled}
          />

          {ctx.isLoadingState && (
            <span className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--color-card-border)' }} aria-busy="true" />
          )}
          {state && (
            <div className="space-y-3">
              {isDrainable(state) && (
                <p
                  role="alert"
                  className="rounded-lg p-3 text-xs font-medium leading-relaxed"
                  style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}
                >
                  {labels.drainableWarning}
                </p>
              )}
              <div className="divide-y divide-[var(--color-card-border)]">
                <Row label={labels.kindLabel}>{labels.kinds[state.kind]}</Row>
                <Row label={labels.reservesLabel}>
                  {state.resources.map((resource) => (
                    <span key={resource} className="block tabular-nums" title={`${state.reserves[resource] ?? '0'} · ${resource}`}>
                      {amount(state.reserves[resource] ?? '0')} {names[resource] ?? truncateAddress(resource, 10, 6)}
                    </span>
                  ))}
                </Row>
                <Row label={labels.poolUnitLabel}>
                  <span title={state.poolUnit}>{names[state.poolUnit] ?? truncateAddress(state.poolUnit, 10, 6)}</span>
                  {ctx.poolUnitSupply !== null && <Sub>{labels.supply.replace('{amount}', amount(ctx.poolUnitSupply))}</Sub>}
                </Row>
                {ctx.account && (
                  <Row label={labels.yourUnitsLabel}>
                    <span className="tabular-nums">{amount(ctx.heldUnits)}</span>
                  </Row>
                )}
                <Row label={labels.managerLabel}>{ruleView(state.manager, ctx.managerProof)}</Row>
                <Row label={labels.ownerLabel}>
                  {ruleView(state.owner, ctx.ownerProof, state.ownerUpdatable ? labels.ownerUpdatable : labels.ownerFixed)}
                </Row>
              </div>
              <RoleBadges
                t={t}
                title={labels.badgesTitle}
                badges={[
                  { rule: state.manager, role: labels.managerRole },
                  { rule: state.owner, role: labels.ownerRole },
                ].flatMap(({ rule, role }) => (rule.type === 'resource' || rule.type === 'nonFungible' ? [{ resource: rule.resource, roles: [role] }] : []))}
                held={(resource) =>
                  ctx.account
                    ? [ctx.managerProof, ctx.ownerProof].some((p) => p?.resource === resource)
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
