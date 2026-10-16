'use client';

import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import { holderKind, type Holder } from '../../lib/resource-holders';
import type { ConsoleDictionary } from '../../types/i18n.types';

const DEFAULT_ROWS = 100;

const pct = (share: number) => `${(share * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} %`;

interface HoldersTableProps {
  t: ConsoleDictionary;
  holders: Holder[];
  /**
   * What the share column divides by: the total held by every holder, so
   * hiding or excluding some never inflates the others' share.
   */
  shareBase: number;
  /** What each address receives in a distribution, as an extra column. */
  received?: Record<string, string>;
  receivedSymbol?: string;
  rows?: number;
}

/** The holders of a token, largest first, with their share of the total. */
export function HoldersTable({ t, holders, shareBase, received, receivedSymbol, rows = DEFAULT_ROWS }: HoldersTableProps) {
  const labels = t.holders;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-card-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              <th className="px-3 py-2 w-12">#</th>
              <th className="px-3 py-2">{labels.colHolder}</th>
              <th className="px-3 py-2 text-right">{labels.colAmount}</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell">{labels.colShare}</th>
              {received && (
                <th className="px-3 py-2 text-right">
                  {labels.colReceives}
                  {receivedSymbol ? ` ${receivedSymbol}` : ''}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, rows).map((h, i) => (
              <tr key={h.address} className="border-t" style={{ borderColor: 'var(--color-card-border)' }}>
                <td className="px-3 py-2 tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  {i + 1}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs" title={h.address}>
                    {truncateAddress(h.address, 12, 6)}
                    <CopyButton value={h.address} size="xs" variant="ghost" title={t.common.copy} />
                    {holderKind(h.address) !== 'account' && (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-sans font-bold uppercase"
                        style={{ background: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}
                      >
                        {labels.kinds[holderKind(h.address)]}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                  {Number(h.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </td>
                <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell" style={{ color: 'var(--color-text-muted)' }}>
                  {shareBase > 0 ? pct(Number(h.amount) / shareBase) : ''}
                </td>
                {received && (
                  <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {received[h.address] ?? '0'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {holders.length > rows && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {labels.showing.replace('{shown}', String(rows)).replace('{total}', String(holders.length))}
        </p>
      )}
    </div>
  );
}
