'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

import { truncateAddress } from '@/utils/formatters';
import { useResourceHolders } from '../../hooks/useResourceHolders';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { downloadTextFile } from '../../lib/file-utils';
import { holderStats, holdersToCsv } from '../../lib/resource-holders';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { HoldersTable } from '../distribution/HoldersTable';
import { MessageLine } from '../shared/MessageLine';
import { ToolSection } from '../shared/ToolSection';
import { AddressField } from '../shared/fields';

const pct = (share: number) => `${(share * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} %`;

/**
 * Who holds a token: every holder (page by page from the Gateway), how
 * concentrated it is and CSV export. Distributions to these holders
 * are prepared where they are sent: bulk send and the locker airdrop.
 */
export default function ResourceHoldersTool({ t }: ConsoleToolProps) {
  const labels = t.holders;
  const [resource, setResource] = useState('');
  const { holders, total, truncated, progress, error, load } = useResourceHolders();
  const names = useResourceLabels([resource]);

  const stats = holderStats(holders ?? []);

  const resourceLabel = names[resource.trim()] ?? truncateAddress(resource.trim(), 10, 6);

  return (
    <div className="space-y-5">
      <ToolSection title={labels.resourceTitle} hint={labels.resourceHint}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <AddressField
              categories={['resource']}
              value={resource}
              onChange={setResource}
              placeholder={t.buildManifest.fieldPlaceholders.resource}
              disabled={!!progress}
            />
          </div>
          <button
            type="button"
            onClick={() => load(resource)}
            disabled={!resource.trim().startsWith('resource_') || !!progress}
            className="h-11 shrink-0 rounded-xl px-5 text-sm font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {labels.load}
          </button>
        </div>
        <MessageLine tone={error ? 'error' : 'muted'}>
          {error
            ? labels.error.replace('{message}', error)
            : progress
              ? labels.loading
                  .replace('{loaded}', String(progress.loaded))
                  .replace('{total}', progress.total === null ? '…' : String(progress.total))
              : undefined}
        </MessageLine>
      </ToolSection>

      {holders && (
        <>
          <ToolSection
            title={labels.summaryTitle.replace('{resource}', resourceLabel)}
            action={
              <button
                type="button"
                onClick={() => downloadTextFile(`holders-${resource.trim().slice(-8)}.csv`, holdersToCsv(holders))}
                disabled={holders.length === 0}
                className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--color-primary)' }}
              >
                <Download className="size-3.5" />
                {labels.exportCsv}
              </button>
            }
          >
            {truncated && (
              <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                {labels.truncated.replace('{loaded}', String(holders.length)).replace('{total}', String(total ?? '?'))}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [labels.statHolders, `${stats.count}${total !== null ? ` / ${total}` : ''}`],
                [labels.statTotal, Number(stats.total).toLocaleString(undefined, { maximumFractionDigits: 4 })],
                [labels.statTop1, pct(stats.top1Share)],
                [labels.statTop10, pct(stats.top10Share)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border p-3" style={{ borderColor: 'var(--color-card-border)', background: 'var(--color-surface)' }}>
                  <span className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {label}
                  </span>
                  <span className="block text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <HoldersTable t={t} holders={holders} shareBase={Number(stats.total)} />
          </ToolSection>
        </>
      )}
    </div>
  );
}
