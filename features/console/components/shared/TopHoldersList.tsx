'use client';
import Link from 'next/link';

import { CopyButton } from '@/components/ui/CopyButton';
import { SafeImage } from '@/components/ui/SafeImage';
import { useLanguage } from '@/context/LanguageContext';
import type { Holder } from '@/features/console/lib/resource-holders';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { getKnownAccountLabel } from '@/features/dashboard/explorador/constants/wellKnownAddresses';
import type { Network } from '@/features/dashboard/types';
import { truncateAddress } from '@/utils/formatters';
import { fmtNumber } from './InfoParts';

/**
 * The largest holders of a resource as short rows: address (opening it in the
 * explorer, with a copy button), amount with its unit, and a bar with its share of the supply.
 * `detail` adds a muted line per holder (e.g. what the share is worth).
 */
export function TopHoldersList({
    holders,
    supply,
    unit,
    network,
    limit = 5,
    detail,
    copyLabel,
}: {
    holders: Holder[];
    /** Total supply of the resource, for the shares. */
    supply: number;
    unit: string;
    network: Network;
    limit?: number;
    detail?: (holder: Holder, share: number) => string;
    copyLabel: string;
}) {
    const { language } = useLanguage();
    return (
        <ul className="divide-y text-sm" style={{ borderColor: 'var(--color-card-border)' }}>
            {holders.slice(0, limit).map((holder) => {
                const share = supply > 0 ? Number(holder.amount) / supply : 0;
                const known = getKnownAccountLabel(holder.address, network);
                return (
                    <li key={holder.address} className="flex items-center justify-between gap-3 py-2 border-[var(--color-card-border)]">
                        <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                                {known && (
                                    <span className="inline-flex items-center gap-1 px-1.5 h-[20px] rounded-full text-[10px] font-bold uppercase tracking-wider leading-none bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shrink-0">
                                        {known.iconUrl && (
                                            <SafeImage
                                                src={known.iconUrl}
                                                alt={known.name}
                                                fallbackName={known.name}
                                                className="size-3.5 rounded-full object-contain bg-white/90 p-0.5 shrink-0"
                                                zoomable={false}
                                            />
                                        )}
                                        <span className="leading-none pt-[1px]">{known.name}</span>
                                    </span>
                                )}
                                <Link
                                    href={dashboardRoutes.entity(language, holder.address, { network })}
                                    className="font-mono text-xs hover:underline"
                                    style={{ color: 'var(--color-primary)' }}
                                    title={holder.address}
                                >
                                    {truncateAddress(holder.address, 12, 6)}
                                </Link>
                                <CopyButton value={holder.address} size="xs" variant="ghost" title={copyLabel} />
                            </span>
                            {detail && (
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                    {detail(holder, share)}
                                </span>
                            )}
                        </span>
                        <span className="shrink-0 text-right">
                            <span className="block font-semibold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                                {fmtNumber(Number(holder.amount), 4)} {unit}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                                <span className="h-1 w-12 rounded-full overflow-hidden" style={{ background: 'var(--color-card-border)' }} aria-hidden>
                                    <span className="block h-full rounded-full" style={{ width: `${Math.min(share * 100, 100)}%`, background: 'var(--color-primary)' }} />
                                </span>
                                {fmtNumber(share * 100, 2)} %
                            </span>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
