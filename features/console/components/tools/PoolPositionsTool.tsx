'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, BadgeCheck, Layers, TriangleAlert, Waves } from 'lucide-react';

import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useConsoleQueryState } from '../../hooks/useConsoleQueryState';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useDexListing, usePoolUnitPositions, useUnitValueChanges } from '../../hooks/useDexPools';
import { usePrecisionPositions, type PositionEstimate } from '../../hooks/usePrecisionPositions';
import { useResourceLabelsState } from '../../hooks/useResourceLabels';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { accountFromQuery, toolQuery } from '../../lib/console-query';
import type { PoolUnitPosition } from '../../lib/pool-positions';
import { claimFeesManifest, removePositionsManifest } from '../../lib/precision-manifests';
import { rangeStatus, type PrecisionPosition, type RangeStatus } from '../../lib/precision-positions';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { MessageLine } from '../shared/MessageLine';
import { OptionButtons } from '../shared/OptionButtons';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
import { TxActions } from '../shared/TxActions';
import { TxResultBanner } from '../shared/TxResultBanner';

type Action = 'claim' | 'remove';

/**
 * Everything an account has in pools, in one place:
 *
 * - native pool units: what they redeem for now, which DEX runs the pool and
 *   the yield it reports, how a unit's value moved over 7 and 30 days, and
 *   links to redeem or add more;
 * - Ociswap Precision positions (concentrated liquidity, one NFT each): what
 *   each pool has earned and what withdrawing would return, simulated live,
 *   and one transaction that either claims the fees (the positions stay) or
 *   withdraws them (liquidity and fees). Both methods are public; the pool
 *   only checks the NFTs are its own.
 */
export default function PoolPositionsTool({ t }: ConsoleToolProps) {
  const labels = t.poolPositions;
  const { language } = useLanguage();
  const [account, setAccount] = useConsoleQueryState<string | null>(accountFromQuery, null);
  const [action, setAction] = useState<Action>('claim');
  // Pools left out of the transaction; every pool is in until unticked.
  const [excluded, setExcluded] = useState<string[]>([]);
  const { positions, loading, error, estimateOf } = usePrecisionPositions(account);
  const units = usePoolUnitPositions(account);
  const { sendTransaction, isSending, result, error: sendError, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();
  const queryClient = useQueryClient();

  const resources = [
    ...positions.flatMap((p) => Object.keys({ ...estimateOf(p.pool)?.data?.withdraw, ...estimateOf(p.pool)?.data?.fees })),
    ...units.positions.flatMap((u) => u.pool.resources),
  ];
  const { labels: names, icons } = useResourceLabelsState(resources);

  const chosen = positions.filter((p) => !excluded.includes(p.pool));
  const groups = chosen.map((p) => ({ pool: p.pool, lpResource: p.lpResource, ids: p.ids }));
  const manifest = account && groups.length ? (action === 'claim' ? claimFeesManifest(account, groups) : removePositionsManifest(account, groups)) : '';

  const toggle = (pool: string) => setExcluded(excluded.includes(pool) ? excluded.filter((p) => p !== pool) : [...excluded, pool]);

  const send = async () => {
    if (await sendTransaction(manifest)) {
      for (const key of ['console-account-resources', 'console-precision-positions', 'console-precision-estimate']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
  };

  const fmt = (value: number) => formatNumber(value, 6, language);

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountTitle}>
        <AccountPicker value={account} onChange={setAccount} />
      </ToolSection>

      <ToolSection title={labels.unitsTitle} hint={labels.unitsHint}>
        {!account ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.pickAccount}</p>
        ) : units.error ? (
          <MessageLine tone="error">{labels.error.replace('{message}', units.error instanceof Error ? units.error.message : String(units.error))}</MessageLine>
        ) : units.loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.loading}</p>
        ) : units.positions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.noUnits}</p>
        ) : (
          <ul className="space-y-4">
            {units.positions.map((u) => (
              <UnitRow key={u.pool.address} position={u} account={account} names={names} icons={icons} fmt={fmt} labels={labels} copyTitle={t.common.copy} language={language} />
            ))}
          </ul>
        )}
      </ToolSection>

      <ToolSection title={labels.positionsTitle} hint={labels.positionsHint}>
        {!account ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.pickAccount}</p>
        ) : error ? (
          <MessageLine tone="error">{labels.error.replace('{message}', error instanceof Error ? error.message : String(error))}</MessageLine>
        ) : loading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.loading}</p>
        ) : positions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{labels.none}</p>
        ) : (
          <ul className="space-y-4">
            {positions.map((p) => (
              <PositionCard
                key={p.pool}
                position={p}
                account={account}
                included={!excluded.includes(p.pool)}
                onToggle={() => toggle(p.pool)}
                estimate={estimateOf(p.pool)?.data}
                estimateError={estimateOf(p.pool)?.error}
                names={names}
                icons={icons}
                fmt={fmt}
                labels={labels}
                copyTitle={t.common.copy}
              />
            ))}
          </ul>
        )}
      </ToolSection>

      {positions.length > 0 && (
        <ToolSection title={labels.actionTitle} hint={action === 'claim' ? labels.claimHint : labels.removeHint}>
          <OptionButtons<Action>
            options={[
              { value: 'claim', label: labels.claimOption },
              { value: 'remove', label: labels.removeOption },
            ]}
            value={action}
            onChange={setAction}
          />
        </ToolSection>
      )}

      <div className="space-y-4">
        <CollapsibleManifest manifest={manifest} showLabel={labels.showManifest} hideLabel={labels.hideManifest} copyLabel={t.common.copy} />
        <TxActions
          t={t}
          onSend={send}
          onSimulate={() => preview.simulate(manifest)}
          sendDisabled={!manifest || isSending}
          simulateDisabled={!manifest || isSending}
          sending={isSending}
          simulating={preview.isSimulating}
          sendLabel={action === 'claim' ? labels.claimButton : labels.removeButton}
          sendingLabel={t.common.sending}
        />
      </div>
      <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
      <TxResultBanner t={t.common} result={result} error={sendError} onReset={reset} />
    </div>
  );
}

/** One pool: its name and Ociswap status, the positions held, and what they pay out now. */
function PositionCard({
  position,
  account,
  included,
  onToggle,
  estimate,
  estimateError,
  names,
  icons,
  fmt,
  labels,
  copyTitle,
}: {
  position: PrecisionPosition;
  account: string;
  included: boolean;
  onToggle: () => void;
  estimate?: PositionEstimate;
  estimateError: unknown;
  names: Record<string, string>;
  icons: Record<string, string>;
  fmt: (value: number) => string;
  labels: ConsoleToolProps['t']['poolPositions'];
  copyTitle: string;
}) {
  const { activeNetwork } = useRadixWallet();
  const { language } = useLanguage();
  const dexListing = useDexListing(position.pool);
  const statusOf = (id: string): RangeStatus | null =>
    position.currentTick !== null && position.ranges[id] ? rangeStatus(position.currentTick, position.ranges[id]) : null;
  const outOfRange = position.ids.filter((id) => {
    const status = statusOf(id);
    return status !== null && status !== 'in';
  });
  // Ociswap has no Stokenet API: there nothing is claimed either way.
  const listing = activeNetwork !== 'mainnet' || !dexListing.isSuccess ? null : { listed: !!dexListing.data, name: dexListing.data?.name };
  const title = (listing?.listed && listing.name) || position.name || labels.unnamed;
  const amounts = (values: Record<string, number> | undefined) =>
    !values ? (
      <span className="block h-4 w-24 rounded animate-pulse" style={{ background: 'var(--color-card-border)' }} />
    ) : Object.keys(values).length === 0 ? (
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.nothing}</span>
    ) : (
      Object.entries(values).map(([resource, value]) => (
        <span key={resource} className="flex items-center gap-1.5 text-sm tabular-nums" title={resource} style={{ color: 'var(--color-text-main)' }}>
          {icons[resource] && <SafeImage src={icons[resource]} alt="" fallbackName={names[resource] ?? resource} zoomable={false} className="size-4 rounded-full object-cover" />}
          <span className="font-bold">{fmt(value)}</span> {names[resource] ?? truncateAddress(resource, 10, 6)}
        </span>
      ))
    );

  return (
    <li className="rounded-xl border p-4 space-y-3" style={{ borderColor: included ? 'var(--color-primary)' : 'var(--color-card-border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <label className="flex items-center gap-2 min-w-0 cursor-pointer">
          <input type="checkbox" checked={included} onChange={onToggle} className="size-4 accent-[var(--color-primary)]" aria-label={labels.include} />
          {position.iconUrl ? (
            <SafeImage src={position.iconUrl} alt="" fallbackName={title} zoomable={false} className="size-6 rounded-full object-cover" />
          ) : (
            <Layers className="size-5" style={{ color: 'var(--color-primary)' }} />
          )}
          <span className="text-sm font-bold truncate" style={{ color: 'var(--color-text-main)' }}>{title}</span>
        </label>
        {listing &&
          (listing.listed ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-success)' }}>
              <BadgeCheck className="size-3.5" /> {labels.listed}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-warning)' }}>
              <TriangleAlert className="size-3.5" /> {labels.notListed}
            </span>
          ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1">
          {labels.poolLabel} <span className="font-mono">{truncateAddress(position.pool, 10, 6)}</span>
          <CopyButton value={position.pool} size="xs" variant="ghost" title={copyTitle} />
        </span>
        <span>{(position.ids.length === 1 ? labels.positionsOne : labels.positionsCount).replace('{count}', String(position.ids.length))}</span>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {position.ids.map((id) => {
          const status = statusOf(id);
          const color = status === null ? 'var(--color-text-muted)' : status === 'in' ? 'var(--color-success)' : 'var(--color-warning)';
          return (
            <li key={id} className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: color, color }}>
              <span className="font-mono">{id}</span> · {status === null ? labels.rangeUnknown : labels.rangeStatus[status]}
            </li>
          );
        })}
      </ul>
      {outOfRange.length > 0 && (
        <div className="space-y-1">
          <MessageLine tone="warning">{(outOfRange.length === 1 ? labels.outOfRangeOne : labels.outOfRangeMany).replace('{count}', String(outOfRange.length))}</MessageLine>
          <Link
            href={`/${language}/console/pool-dex-add?${toolQuery({ pool: position.pool, account })}`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-primary)]"
            style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
          >
            <ArrowDownToLine className="size-3.5" /> {labels.newRangeLink}
          </Link>
        </div>
      )}

      {estimateError ? (
        <MessageLine tone="error">
          {labels.estimateError.replace('{message}', estimateError instanceof Error ? estimateError.message : String(estimateError))}
        </MessageLine>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{labels.feesLabel}</span>
            {amounts(estimate?.fees)}
          </div>
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{labels.withdrawLabel}</span>
            {amounts(estimate?.withdraw)}
          </div>
        </div>
      )}
    </li>
  );
}

/** One native pool the account has units of: their value now, the DEX and its yield, and how a unit moved. */
function UnitRow({
  position,
  account,
  names,
  icons,
  fmt,
  labels,
  copyTitle,
  language,
}: {
  position: PoolUnitPosition;
  account: string;
  names: Record<string, string>;
  icons: Record<string, string>;
  fmt: (value: number) => string;
  labels: ConsoleToolProps['t']['poolPositions'];
  copyTitle: string;
  language: string;
}) {
  const { pool } = position;
  const { activeNetwork } = useRadixWallet();
  const listing = useDexListing(pool.address);
  const changes = useUnitValueChanges(pool.address, pool.poolUnit, [7, 30]);
  const apr = listing.data ? listing.data.aprByPool[pool.address] ?? listing.data.apr : null;
  const share = position.supply > 0 ? (position.units / position.supply) * 100 : 0;
  const title = position.name || pool.resources.map((r) => names[r] ?? truncateAddress(r, 6, 4)).join(' / ');
  const pct = (value: number) => `${value >= 0 ? '+' : ''}${fmt(value * 100)} %`;
  const query = toolQuery({ pool: pool.address, account });

  return (
    <li className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-card-border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <Waves className="size-5 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm font-bold truncate" style={{ color: 'var(--color-text-main)' }}>{title}</span>
        </span>
        {activeNetwork === 'mainnet' && listing.data && (
          <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-success)' }}>
            <BadgeCheck className="size-3.5" /> {labels.dexNames[listing.data.dex]}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1">
          {labels.poolLabel} <span className="font-mono">{truncateAddress(pool.address, 10, 6)}</span>
          <CopyButton value={pool.address} size="xs" variant="ghost" title={copyTitle} />
        </span>
        <span>{labels.unitsHeld.replace('{units}', fmt(position.units)).replace('{share}', fmt(share))}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{labels.worthLabel}</span>
          {Object.entries(position.value).map(([resource, value]) => (
            <span key={resource} className="flex items-center gap-1.5 text-sm tabular-nums" title={resource} style={{ color: 'var(--color-text-main)' }}>
              {icons[resource] && <SafeImage src={icons[resource]} alt="" fallbackName={names[resource] ?? resource} zoomable={false} className="size-4 rounded-full object-cover" />}
              <span className="font-bold">{fmt(value)}</span> {names[resource] ?? truncateAddress(resource, 10, 6)}
            </span>
          ))}
        </div>
        <div className="space-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{labels.yieldLabel}</span>
          {apr !== null && <span className="block text-sm" style={{ color: 'var(--color-text-main)' }}>{labels.dexApr.replace('{apr}', fmt(apr * 100))}</span>}
          {[7, 30].map((days, i) => {
            const change = changes[i]?.data;
            return (
              <span key={days} className="block text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                {changes[i]?.isPending
                  ? '…'
                  : change
                    ? labels.unitChange.replace('{days}', String(days)).replace('{change}', pct(change.growth)).replace('{annual}', pct(change.annualized))
                    : labels.unitChangeNone.replace('{days}', String(days))}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/${language}/console/pool-redeem?${query}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-primary)]" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}>
          <ArrowUpFromLine className="size-3.5" /> {labels.redeemLink}
        </Link>
        <Link href={`/${language}/console/pool-dex-add?${query}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-primary)]" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}>
          <ArrowDownToLine className="size-3.5" /> {labels.addMoreLink}
        </Link>
      </div>
    </li>
  );
}
