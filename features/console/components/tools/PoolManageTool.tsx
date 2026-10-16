'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { usePoolFormContext } from '../../hooks/usePoolFormContext';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isDrainable, metadataTags } from '../../lib/pool-lookup';
import { managePoolManifest, RETIRED_TAG } from '../../lib/pool-manifests';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { fmtNumber, Note } from '../shared/InfoParts';
import { PoolFormShell } from '../pool/PoolFormShell';
import { FormBlock } from '../validator/FormBlock';

/**
 * Winds a pool down, in one transaction: takes the reserves out, tags the pool
 * and its unit as retired, and freezes their profile and owner role. Each step
 * is its own switch, locked with the reason when the account cannot take it or
 * the pool already went through it.
 */
export default function PoolManageTool({ t }: ConsoleToolProps) {
  const labels = t.pool;
  const form = labels.forms.manage;
  const ctx = usePoolFormContext();
  const { state } = ctx;
  const { activeNetwork } = useRadixWallet();
  const names = useResourceLabels(state?.resources ?? []);
  const [empty, setEmpty] = useState(false);
  const [retire, setRetire] = useState(false);
  const [lock, setLock] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // The unit's own tags, so retiring it keeps the ones it has.
  const { data: unitTags } = useQuery({
    queryKey: ['console-pool-unit-tags', activeNetwork, state?.poolUnit],
    enabled: !!state?.poolUnit,
    staleTime: 15_000,
    retry: false,
    queryFn: async () => metadataTags(await apiFetchEntityDetails(state!.poolUnit, activeNetwork, true)),
  });

  const filled = Object.entries(state?.reserves ?? {}).filter(([, amount]) => Number(amount) > 0);
  const canManage = !!ctx.managerProof || (state ? isDrainable(state) : false);
  const canOwn = !!ctx.ownerProof || state?.owner.type === 'allowAll';
  const retired = !!state?.tags.includes(RETIRED_TAG);
  const frozen = state ? !state.ownerUpdatable : false;
  // Units held by other accounts: emptying leaves them a claim on nothing.
  const othersUnits = Math.max((ctx.poolUnitSupply ?? 0) - ctx.heldUnits, 0);

  const emptyLocked = !state ? undefined : !canManage ? form.needsManager : !filled.length ? form.alreadyEmpty : undefined;
  const retireLocked = !state ? undefined : !canOwn ? form.needsOwner : retired ? form.alreadyRetired : undefined;
  const lockLocked = !state ? undefined : !canOwn ? form.needsOwner : frozen ? form.alreadyFrozen : undefined;

  const doEmpty = empty && !emptyLocked;
  const doRetire = retire && !retireLocked;
  const doLock = lock && !lockLocked;

  const blockedReason = !state
    ? undefined
    : emptyLocked && retireLocked && lockLocked
      ? form.nothingAvailable
      : !doEmpty && !doRetire && !doLock
        ? form.nothingChosen
        : doRetire && !unitTags
          ? form.loadingTags
          : doLock && !confirmed
            ? form.confirmNeeded
            : undefined;

  const manifest =
    ctx.account && state && !blockedReason
      ? managePoolManifest({
          account: ctx.account,
          pool: state.address,
          kind: state.kind,
          poolUnit: state.poolUnit,
          reserves: state.reserves,
          manager: ctx.managerProof,
          owner: ctx.ownerProof,
          empty: doEmpty,
          retire: doRetire ? { poolTags: state.tags, unitTags: unitTags ?? [] } : undefined,
          lockOwner: doLock,
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
      sendLabel={form.sendButton}
    >
      <div>
        <FormBlock
          title={form.empty.title}
          description={form.empty.description}
          enabled={empty}
          onToggle={setEmpty}
          lockedReason={emptyLocked}
        >
          <div className="space-y-3 sm:col-span-2">
            <dl className="divide-y divide-[var(--color-card-border)] text-xs">
              {filled.map(([resource, amount]) => (
                <div key={resource} className="flex items-center justify-between gap-3 py-1.5">
                  <dt style={{ color: 'var(--color-text-muted)' }} title={resource}>
                    {names[resource] ?? resource.slice(0, 18)}
                  </dt>
                  <dd className="font-semibold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                    {fmtNumber(Number(amount), 6)}
                  </dd>
                </div>
              ))}
            </dl>
            {othersUnits > 0 && (
              <Note tone="warning">{form.empty.othersWarning.replace('{units}', fmtNumber(othersUnits, 6))}</Note>
            )}
          </div>
        </FormBlock>
        <FormBlock
          title={form.retire.title}
          description={form.retire.description}
          enabled={retire}
          onToggle={setRetire}
          lockedReason={retireLocked}
        >
          <div className="sm:col-span-2">
            <Note tone="muted">{form.retire.note}</Note>
          </div>
        </FormBlock>
        <FormBlock
          title={form.lock.title}
          description={form.lock.description}
          enabled={lock}
          onToggle={setLock}
          lockedReason={lockLocked}
        >
          <div className="space-y-3 sm:col-span-2">
            <Note tone="warning">{form.lock.warning}</Note>
            <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-text-main)' }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-[var(--color-primary)]"
              />
              {form.lock.confirm}
            </label>
          </div>
        </FormBlock>
      </div>
    </PoolFormShell>
  );
}
