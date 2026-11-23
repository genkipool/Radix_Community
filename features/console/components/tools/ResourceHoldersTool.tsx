'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { truncateAddress } from '@/utils/formatters';
import { useResourceHolders } from '../../hooks/useResourceHolders';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isNonFungibleResource } from '../../lib/bulk-send';
import { downloadTextFile } from '../../lib/file-utils';
import { holderStats, holdersToCsv } from '../../lib/resource-holders';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { HoldersTable } from '../distribution/HoldersTable';
import { MessageLine } from '../shared/MessageLine';
import { ToolSection } from '../shared/ToolSection';
import { AddressField } from '../shared/fields';

const pct = (share: number) => `${(share * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} %`;

/**
 * Who holds a token or NFT collection: every holder (page by page from the Gateway),
 * how concentrated it is and CSV export. Selecting or pasting a resource loads
 * its holders automatically without an extra button click.
 */
export default function ResourceHoldersTool({ t }: ConsoleToolProps) {
  const labels = t.holders;
  const { activeNetwork } = useRadixWallet();
  const [resource, setResource] = useState('');
  const { holders, total, truncated, progress, error, load } = useResourceHolders();
  const names = useResourceLabels([resource]);

  const trimmed = resource.trim();

  const { data: detectedNft } = useQuery({
    queryKey: ['console', 'resource-kind', activeNetwork, trimmed],
    enabled: trimmed.startsWith('resource_') && trimmed.length >= 20,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const res = await gatewayPost<{ items?: Array<{ details?: { type?: string } }> }>(
        activeNetwork,
        '/state/entity/details',
        { addresses: [trimmed] },
      );
      return res.items?.[0]?.details?.type === 'NonFungibleResource';
    },
  });
  const isNft = detectedNft ?? isNonFungibleResource(trimmed);

  const lastLoadedRef = useRef('');

  // Auto-fetch as soon as a valid resource address is selected or pasted.
  useEffect(() => {
    const key = `${activeNetwork}:${trimmed}`;
    if (trimmed.startsWith('resource_') && trimmed.length >= 20 && lastLoadedRef.current !== key) {
      lastLoadedRef.current = key;
      void load(trimmed);
    }
  }, [activeNetwork, trimmed, load]);

  const stats = holderStats(holders ?? []);
  const resourceLabel = names[trimmed] ?? truncateAddress(trimmed, 10, 6);

  return (
    <div className="space-y-5">
      <ToolSection title={isNft ? labels.nftTitle : labels.resourceTitle} hint={labels.resourceHint}>
        <AddressField
          categories={['resource']}
          value={resource}
          onChange={setResource}
          placeholder={t.buildManifest.fieldPlaceholders.resource}
        />
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
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs uppercase font-black tracking-widest" style={{ color: 'var(--color-text-main)' }}>
              {labels.summaryTitle.replace('{resource}', resourceLabel)}
            </h2>
            <button
              type="button"
              onClick={() => downloadTextFile(`holders-${trimmed.slice(-8)}.csv`, holdersToCsv(holders))}
              disabled={holders.length === 0}
              className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer hover:opacity-70 disabled:opacity-40"
              style={{ color: 'var(--color-primary)' }}
            >
              <Download className="size-3.5" />
              {labels.exportCsv}
            </button>
          </div>

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
                <span className="block text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  {label}
                </span>
                <span className="block text-base font-bold font-mono tabular-nums mt-0.5" style={{ color: 'var(--color-text-main)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <HoldersTable t={t} holders={holders} shareBase={Number(stats.total)} />
        </section>
      )}
    </div>
  );
}
