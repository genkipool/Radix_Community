'use client';

import { CopyButton } from '@/components/ui/CopyButton';
import { FundingSource, ExplorerTarget } from '../../types/data.types';
import { CommunityDictionary } from '../../types/i18n.types';
import { fmtXrd, fmtUsd, fmtDate } from '../../utils/formatters';
import { ExplorerButton } from '../shared/ExplorerButton';

interface FundingSourceRowProps {
    source: FundingSource;
    t: CommunityDictionary;
    onShowExplorer: (t: ExplorerTarget) => void;
}

export function FundingSourceRow({ source, t, onShowExplorer }: FundingSourceRowProps) {
    const { funding_labels: labels, funding_contributors: contributors } = t;

    const typeColors: Record<string, { bg: string; text: string; label: string }> = {
        donation: { bg: 'rgba(16,185,129,0.10)', text: '#10b981', label: t.funding_type_donation ?? 'Donation' },
        grant: { bg: 'rgba(99,102,241,0.10)', text: '#6366f1', label: t.funding_type_grant ?? 'Grant' },
        treasury: { bg: 'rgba(245,158,11,0.10)', text: '#f59e0b', label: t.funding_type_treasury ?? 'Treasury' },
        event: { bg: 'rgba(244,63,94,0.10)', text: '#f43f5e', label: t.funding_type_event ?? 'Event' },
    };
    const style = typeColors[source.type] ?? typeColors.donation;

    return (
        <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid var(--color-card-border)' }}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                        {labels[source.labelKey] ?? source.labelKey}
                    </p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: style.bg, color: style.text }}>
                        {style.label}
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{contributors[source.contributorKey] ?? source.contributorKey}</span>
                    <span>·</span>
                    <span>{fmtDate(source.date)}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-md"
                        style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}>
                        {t.funding_price_at_delivery ?? 'XRD price'}: <strong style={{ color: 'var(--color-text-main)' }}>${source.xrdPriceAtDelivery.toFixed(3)}</strong>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                        {t.funding_usd_value ?? 'USD'}: <strong>{fmtUsd(source.usdValueAtDelivery)}</strong>
                    </span>
                </div>
                {source.txHash && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                            {source.txHash.slice(0, 24)}…
                        </span>
                        <CopyButton value={source.txHash} label={t.copy_tx} size="xs" />
                        <ExplorerButton
                            target={{ kind: 'tx', hash: source.txHash }}
                            label={t.explorer_view ?? 'Explorer'}
                            size="xs"
                            onClick={onShowExplorer}
                        />
                    </div>
                )}
            </div>
            <div className="text-right shrink-0 pt-0.5">
                <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                    {fmtXrd(source.amount)}
                </p>
                <p className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    ≈ {fmtUsd(source.usdValueAtDelivery)}
                </p>
            </div>
        </div>
    );
}
