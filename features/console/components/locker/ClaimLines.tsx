'use client';

import { Gift } from 'lucide-react';

import { SafeImage } from '@/components/ui/SafeImage';
import { formatNumber } from '@/utils/formatters';
import type { LockerClaim } from '../../lib/locker-lookup';

/** Units longer than this end in an ellipsis; each line's title has them whole. */
const UNIT_MAX = 5;
const shortUnit = (unit: string) => (unit.length > UNIT_MAX ? `${unit.slice(0, UNIT_MAX)}…` : unit);

/**
 * What waits in a locker, one resource per line: its icon, the amount and the
 * unit (the symbol, or NFT), right-aligned so the amounts line up. A list
 * reads better than one long "4 XRD · 250 TPA · 2 NFT" line.
 */
export function ClaimLines({
  claims,
  labels,
  icons,
  locale,
}: {
  claims: LockerClaim[];
  /** Symbol (else name) per resource. */
  labels: Record<string, string>;
  icons: Record<string, string>;
  locale: string;
}) {
  return (
    <ul className="flex flex-col items-end gap-1">
      {claims.map((claim) => {
        const unit = claim.nftIds ? 'NFT' : labels[claim.resource] ?? '';
        const amount = claim.nftIds ? String(claim.nftIds.length) : formatNumber(Number(claim.amount ?? 0), 6, locale);
        const name = labels[claim.resource] ?? claim.resource;
        const title = claim.nftIds ? `${amount} NFT ${name}: ${claim.nftIds.join(', ')}` : `${amount} ${unit || claim.resource}`;
        return (
          <li key={claim.resource} className="flex items-center gap-2 whitespace-nowrap" title={title}>
            <span className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
              {amount} <span className="font-semibold">{shortUnit(unit)}</span>
            </span>
            {icons[claim.resource] ? (
              <SafeImage src={icons[claim.resource]} alt={name} fallbackName={name} zoomable={false} className="size-5 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="size-5 shrink-0 rounded-full grid place-items-center" style={{ background: 'var(--color-card-border)' }}>
                <Gift className="size-3" style={{ color: 'var(--color-text-muted)' }} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
