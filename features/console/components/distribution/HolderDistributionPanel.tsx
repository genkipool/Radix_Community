'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ListChecks } from 'lucide-react';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useResourceHolders } from '../../hooks/useResourceHolders';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isPositiveDecimal, normalizeDecimal } from '../../lib/decimal';
import { downloadTextFile } from '../../lib/file-utils';
import { distribute, distributionToCsv, type DistributionMode } from '../../lib/resource-holders';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { MessageLine } from '../shared/MessageLine';
import { OptionButtons } from '../shared/OptionButtons';
import { AddressField, TextField } from '../shared/fields';
import { DEFAULT_HOLDER_FILTER, HolderFilters, applyHolderFilter } from './HolderFilters';
import { HoldersTable } from './HoldersTable';

interface HolderDistributionPanelProps {
  t: ConsoleDictionary;
  /** Receives the distribution as a bulk-send CSV (account, amount, resource). */
  onUse: (csv: string) => void;
  /** Lays out the panel: the body goes in the caller's box, the actions under it. */
  frame: (body: ReactNode, actions: ReactNode) => ReactNode;
}

/**
 * Builds a recipient list out of the holders of a token: load them, filter
 * them, and split a pot equally or pro rata. The list is handed over as CSV,
 * so the tool that sends it validates and batches it like any other list.
 */
export function HolderDistributionPanel({ t, onUse, frame }: HolderDistributionPanelProps) {
  const labels = t.holders;
  const { activeNetwork } = useRadixWallet();
  const { holders, total, progress, error, load } = useResourceHolders();

  const [source, setSource] = useState('');
  const [filter, setFilter] = useState(DEFAULT_HOLDER_FILTER);
  const [sendResource, setSendResource] = useState('');
  const [pot, setPot] = useState('');
  const [mode, setMode] = useState<DistributionMode>('proportional');
  const names = useResourceLabels([sendResource.trim()]);

  const filtered = holders ? applyHolderFilter(holders, filter) : [];
  const heldByAll = (holders ?? []).reduce((sum, h) => sum + Number(h.amount), 0);

  const { data: divisibility } = useQuery({
    queryKey: ['console-divisibility', activeNetwork, sendResource.trim()],
    enabled: sendResource.trim().startsWith('resource_'),
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const details = (await apiFetchEntityDetails(sendResource.trim(), activeNetwork)) as unknown as {
        details?: { divisibility?: number };
      };
      return details.details?.divisibility ?? 18;
    },
  });

  const potValue = normalizeDecimal(pot);
  const distribution =
    sendResource.trim().startsWith('resource_') && isPositiveDecimal(potValue) && divisibility !== undefined
      ? distribute(filtered, potValue, mode, divisibility)
      : [];
  const csv = distribution.length ? distributionToCsv(distribution, sendResource.trim()) : '';
  const received = distribution.length ? Object.fromEntries(distribution.map((d) => [d.address, d.amount])) : undefined;

  const status = progress
    ? labels.loading
        .replace('{loaded}', String(progress.loaded))
        .replace('{total}', progress.total === null ? '…' : String(progress.total))
    : holders
      ? labels.holdersMatching.replace('{count}', String(filtered.length)).replace('{total}', String(total ?? holders.length))
      : undefined;

  const body = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <AddressField
              categories={['resource']}
              label={labels.holdersOf}
              value={source}
              onChange={setSource}
              placeholder={t.buildManifest.fieldPlaceholders.resource}
              disabled={!!progress}
            />
          </div>
          <button
            type="button"
            onClick={() => load(source)}
            disabled={!source.trim().startsWith('resource_') || !!progress}
            className="h-11 shrink-0 rounded-xl px-5 text-sm font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {labels.load}
          </button>
        </div>
        <MessageLine tone={error ? 'error' : 'muted'}>
          {error ? labels.error.replace('{message}', error) : status}
        </MessageLine>
      </div>

      {holders && (
        <>
          <HolderFilters t={t} holders={holders} value={filter} onChange={setFilter} />
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
            <AddressField
              categories={['resource']}
              label={labels.sendResource}
              value={sendResource}
              onChange={setSendResource}
              placeholder={t.buildManifest.fieldPlaceholders.resource}
            />
            <TextField
              label={labels.pot.replace('{symbol}', names[sendResource.trim()] ?? '')}
              value={pot}
              onChange={setPot}
              placeholder="1000"
              error={pot && !isPositiveDecimal(potValue) ? labels.potError : undefined}
              reserveMessage
            />
            <OptionButtons<DistributionMode>
              layout="grid"
              className="sm:grid-cols-2"
              size="sm"
              options={[
                { value: 'proportional', label: labels.modeProportional, description: labels.modeProportionalHint },
                { value: 'equal', label: labels.modeEqual, description: labels.modeEqualHint },
              ]}
              value={mode}
              onChange={setMode}
            />
            <MessageLine>
              {distribution.length > 0 &&
                labels.distributionSummary
                  .replace('{count}', String(distribution.length))
                  .replace('{first}', distribution[0].amount)
                  .replace('{decimals}', String(divisibility))}
            </MessageLine>
            <HoldersTable
              t={t}
              holders={filtered}
              shareBase={heldByAll}
              received={received}
              receivedSymbol={names[sendResource.trim()]}
            />
          </div>
        </>
      )}
    </div>
  );

  const actions = holders ? (
    <div className="flex flex-col sm:flex-row gap-4">
      <button
        type="button"
        onClick={() => onUse(csv)}
        disabled={!csv}
        className="inline-flex flex-1 h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ListChecks className="size-4" />
        {labels.useDistribution}
      </button>
      <button
        type="button"
        onClick={() => downloadTextFile('distribution.csv', csv)}
        disabled={!csv}
        className="inline-flex flex-1 h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold cursor-pointer hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
      >
        <Download className="size-4" />
        {labels.downloadDistribution}
      </button>
    </div>
  ) : null;

  return frame(body, actions);
}
