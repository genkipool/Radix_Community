'use client';

import { CopyButton } from '@/components/ui/CopyButton';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { radixSealAddress } from '@/features/sign/constants/seal';

/**
 * The official Radix Seal brand-resource addresses per network, so users can
 * confirm which resource is the genuine one. Networks without a configured
 * address are omitted. Values come from the RADIX_SEAL constant (env-derived).
 */
export function SealResourceAddresses({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  const rows = [
    { network: 'Mainnet', address: radixSealAddress(RadixNetworkId.Mainnet) },
    { network: 'Stokenet', address: radixSealAddress(RadixNetworkId.Stokenet) },
  ].filter((r) => r.address);

  if (rows.length === 0) return null;

  return (
    <div className="mt-14 max-w-3xl mx-auto rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-6 space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-bold text-[var(--color-text-main)]">{title}</h3>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{hint}</p>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.network}
            className="flex items-center gap-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-3"
          >
            <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              {r.network}
            </span>
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--color-text-main)]">
              {r.address}
            </code>
            <CopyButton value={r.address} variant="minimal" size="sm" className="shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
