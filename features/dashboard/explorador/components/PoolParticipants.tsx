'use client';
import Link from 'next/link';

import { useLanguage } from '@/context/LanguageContext';
import type { PoolState } from '@/features/console/lib/pool-lookup';
import type { AccountPoolFlows } from '@/features/console/lib/pool-history';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import type { Network } from '@/features/dashboard/types';
import { formatNumber } from '@/utils/formatters';
import { usePoolContributions } from '@/features/console/hooks/usePoolContributions';
import { useTopHolders } from '@/features/console/hooks/useTopHolders';
import { CopyButton, PlainSummary } from './SummaryCardKit';


/**
 * Who takes part in a pool: the holders of its pool unit, largest first, with
 * their units, their share of the supply, what they have put in and taken
 * back (from the pool's history), what their share redeems for now, and a
 * way to redeem it in the console.
 * Holders come from the same reader as the console's holder tools.
 */
export function PoolParticipants({
    pool,
    supply,
    unitSymbol,
    names,
    network,
    locale,
    copiedAddress,
    onCopy,
}: {
    pool: PoolState;
    /** Pool units in circulation. */
    supply: number;
    /** The pool unit's symbol (or name), shown beside each holding. */
    unitSymbol: string;
    /** Symbol (or name) per reserve resource. */
    names: Record<string, string>;
    network: Network;
    locale: string;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
}) {
    const c = useLanguage().t.dashboard?.entity_cards;
    const p = c?.pool;
    const { data, isLoading, isError } = useTopHolders(pool.poolUnit, network);
    const { data: contributions } = usePoolContributions(pool, network);
    const amount = (value: number) => formatNumber(value, 6, locale);
    const flow = (account: string, side: keyof AccountPoolFlows, resource: string) =>
        contributions ? Number(contributions.byAccount[account]?.[side][resource] ?? 0) : null;
    const perResource = (values: (resource: string) => number | null) => (
        <ul className="space-y-0.5">
            {pool.resources.map((resource) => {
                const value = values(resource);
                return (
                    <li key={resource} className="font-mono tabular-nums whitespace-nowrap">
                        {value === null ? '…' : amount(value)} <span className="font-sans text-[var(--color-text-muted)]">{names[resource] ?? '?'}</span>
                    </li>
                );
            })}
        </ul>
    );
    const copyTitle = c?.copy ?? 'Copy';

    if (isLoading) return <PlainSummary>{p?.participants_loading}</PlainSummary>;
    if (isError) return <PlainSummary>{p?.participants_error}</PlainSummary>;
    if (!data?.holders.length) return null;

    return (
        <div className="overflow-x-auto">
            <h4 className="mb-1 text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                {p?.participants ?? 'Participants'} ({data.total ?? data.holders.length})
            </h4>
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                        <th className="py-2 pr-4 text-left font-semibold">{p?.participant ?? 'Address'}</th>
                        <th className="py-2 pr-4 text-right font-semibold">{p?.units_held ?? 'Units'}</th>
                        <th className="py-2 pr-4 text-right font-semibold">{p?.share ?? 'Share'}</th>
                        <th className="py-2 pr-4 text-right font-semibold">{p?.contributed ?? 'Put in'}</th>
                        <th className="py-2 pr-4 text-right font-semibold">{p?.redeemed ?? 'Taken out'}</th>
                        <th className="py-2 pr-4 text-right font-semibold">{p?.entitled ?? 'Redeems for'}</th>
                        <th className="py-2" aria-hidden />
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-card-border)] border-t border-[var(--color-card-border)]">
                    {data.holders.map((holder) => {
                        const units = Number(holder.amount);
                        const share = supply > 0 ? units / supply : 0;
                        return (
                            <tr key={holder.address}>
                                <td className="py-2.5 pr-4 align-middle">
                                    <span className="flex items-center gap-1 whitespace-nowrap">
                                        <Link
                                            href={dashboardRoutes.entity(locale, holder.address, { network })}
                                            className="font-mono text-[var(--color-primary)] hover:underline"
                                            title={holder.address}
                                        >
                                            {holder.address.slice(0, 14)}…{holder.address.slice(-6)}
                                        </Link>
                                        <CopyButton value={holder.address} copiedAddress={copiedAddress} onCopy={onCopy} title={copyTitle} />
                                    </span>
                                </td>
                                <td className="py-2.5 pr-4 text-right align-middle font-mono font-semibold tabular-nums whitespace-nowrap">
                                    {amount(units)} <span className="font-sans font-normal text-[var(--color-text-muted)]">{unitSymbol}</span>
                                </td>
                                <td className="py-2.5 pr-4 text-right align-middle tabular-nums">
                                    <span className="inline-flex items-center gap-2">
                                        <span className="h-1.5 w-14 rounded-full bg-[var(--color-card-border)] overflow-hidden" aria-hidden>
                                            <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.min(share * 100, 100)}%` }} />
                                        </span>
                                        {formatNumber(share * 100, 2, locale)} %
                                    </span>
                                </td>
                                <td className="py-2.5 pr-4 text-right align-middle">
                                    {perResource((resource) => flow(holder.address, 'putIn', resource))}
                                </td>
                                <td className="py-2.5 pr-4 text-right align-middle">
                                    {perResource((resource) => flow(holder.address, 'takenOut', resource))}
                                </td>
                                <td className="py-2.5 pr-4 text-right align-middle">
                                    {perResource((resource) => share * Number(pool.reserves[resource] ?? 0))}
                                </td>
                                <td className="py-2.5 text-right align-middle whitespace-nowrap">
                                    {holder.address.startsWith('account_') && (
                                        // A full page load: the console reads its query when it opens.
                                        <a
                                            href={`/${locale}/console/pool-redeem?pool=${pool.address}&account=${holder.address}`}
                                            className="font-bold text-[var(--color-primary)] hover:underline"
                                        >
                                            {p?.redeem ?? 'Redeem in the console'} →
                                        </a>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {contributions?.truncated && (
                <p className="pt-2 text-[11px] text-[var(--color-text-muted)]">
                    {(p?.contributions_partial ?? 'Contributions cover the latest {count} transactions.').replace('{count}', String(contributions.transactions))}
                </p>
            )}
            {data.truncated && (
                <p className="pt-2 text-[11px] text-[var(--color-text-muted)]">
                    {(p?.participants_top ?? 'Showing the {count} largest of {total}.')
                        .replace('{count}', String(data.holders.length))
                        .replace('{total}', String(data.total ?? '?'))}
                </p>
            )}
        </div>
    );
}
