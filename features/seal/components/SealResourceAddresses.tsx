'use client';

import { ExternalLink } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { radixSealAddress } from '@/features/sign/constants/seal';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';

/**
 * This site's own explorer, opened straight on the resource. The dashboard's
 * `tx` parameter takes an ADDRESS as readily as a transaction hash (it runs
 * `validateAddress` before `validateTxHash`), so one link covers both.
 */
function explorerResourceUrl(locale: string, network: string, address: string): string {
  return dashboardRoutes.entity(locale, address, {
    network: network === 'Mainnet' ? 'mainnet' : 'stokenet',
  });
}

/**
 * The official Radix Seal brand-resource addresses per network, so users can
 * confirm which resource is the genuine one. Networks without a configured
 * address are omitted. Values come from the RADIX_SEAL constant (env-derived).
 */
export function SealResourceAddresses({
  locale,
  title,
  hint,
  explorerLabel,
  /** Wrapper classes, so the caller can place it in a grid cell. */
  className = 'mt-14 max-w-3xl mx-auto',
}: {
  locale: string;
  title: string;
  hint: string;
  /** Text for the per-network explorer link. */
  explorerLabel: string;
  className?: string;
}) {
  const rows = [
    { network: 'Mainnet', address: radixSealAddress(RadixNetworkId.Mainnet) },
    { network: 'Stokenet', address: radixSealAddress(RadixNetworkId.Stokenet) },
  ].filter((r) => r.address);

  if (rows.length === 0) return null;

  return (
    <div
      className={`rounded-3xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-6 sm:p-8 space-y-4 ${className}`}
    >
      <div className="space-y-1">
        <h3 className="text-base font-bold text-[var(--color-text-main)]">{title}</h3>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{hint}</p>
      </div>
      {/* Network on top, full address underneath and unboxed: these have to be
          read character by character to confirm a resource, so the address is
          shown whole rather than truncated inside a nested card. */}
      <div className="space-y-6">
        {rows.map((r) => (
          <div key={r.network} className="space-y-2.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              {r.network}
            </span>
            {/* Indented under its network. The copy control aligns with the
                FIRST line of the address, not the middle of the wrapped block;
                the small offset cancels the button's own padding so its icon
                sits on that line's optical centre. */}
            <div className="flex items-start gap-2 pl-3 sm:pl-4">
              <code className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-[var(--color-text-main)]">
                {r.address}
              </code>
              <CopyButton
                value={r.address}
                variant="minimal"
                size="sm"
                className="shrink-0 -mt-2"
              />
            </div>
            <a
              href={explorerResourceUrl(locale, r.network, r.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 pl-3 sm:pl-4 text-xs font-semibold text-[var(--color-primary)] transition-opacity hover:opacity-80"
            >
              {explorerLabel}
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
