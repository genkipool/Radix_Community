'use client';

import Link from 'next/link';
import { CopyButton } from '@/components/ui/CopyButton';
import { useLanguage } from '@/context/LanguageContext';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import type { Holder } from '../../lib/resource-holders';
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

/**
 * The holders of a token, styled to match the explorer's minimalist tables
 * (RewardsYearsTable): surface header band, crisp py-3 px-4 rows, hairline
 * dividers and primary hover tint.
 */
export function HoldersTable({ t, holders, shareBase, received, receivedSymbol, rows = DEFAULT_ROWS }: HoldersTableProps) {
  const labels = t.holders;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const th = 'py-3 px-4 font-semibold whitespace-nowrap';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-card-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]">
              <th className={`${th} w-12`}>#</th>
              <th className={th}>{labels.colHolder}</th>
              <th className={`${th} text-right`}>{labels.colAmount}</th>
              <th className={`${th} text-right hidden sm:table-cell`}>{labels.colShare}</th>
              {received && (
                <th className={`${th} text-right`}>
                  {labels.colReceives}
                  {receivedSymbol ? ` ${receivedSymbol}` : ''}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, rows).map((h, i) => (
              <tr
                key={h.address}
                className="border-b border-[var(--color-card-border)] last:border-b-0 transition-colors duration-150 hover:bg-[var(--color-primary)]/[0.06]"
              >
                <td className="py-3 px-4 font-mono text-xs tabular-nums text-[var(--color-text-muted)] whitespace-nowrap">
                  {i + 1}
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs" title={h.address}>
                    <Link
                      href={dashboardRoutes.entity(language, h.address, { network: activeNetwork })}
                      className="text-[var(--color-primary)] hover:underline font-semibold"
                    >
                      {truncateAddress(h.address, 12, 6)}
                    </Link>
                    <CopyButton value={h.address} size="xs" variant="ghost" title={t.common.copy} />
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs font-bold tabular-nums text-[var(--color-accent)] whitespace-nowrap">
                  {Number(h.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs tabular-nums hidden sm:table-cell text-[var(--color-text-muted)] whitespace-nowrap">
                  {shareBase > 0 ? pct(Number(h.amount) / shareBase) : ''}
                </td>
                {received && (
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums font-bold text-[var(--color-primary)] whitespace-nowrap">
                    {received[h.address] ?? '0'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {holders.length > rows && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {labels.showing.replace('{shown}', String(rows)).replace('{total}', String(holders.length))}
        </p>
      )}
    </div>
  );
}
