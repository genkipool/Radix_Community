'use client';
import Link from 'next/link';

import { useLanguage } from '@/context/LanguageContext';
import { useResourceLabels } from '@/features/console/hooks/useResourceLabels';
import { MAX_LOCKER_RECIPIENTS, useLockerWaiting } from '@/features/console/hooks/useLockerWaiting';
import { LOCKER_HISTORY_PAGES, useLockerActivity as useSharedLockerActivity } from '@/features/console/hooks/useLockerActivity';
import { parseLockerState } from '@/features/console/lib/locker-lookup';
import type { RuleView } from '@/features/console/lib/role-lookup';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import type { Network } from '@/features/dashboard/types';
import { formatNumber } from '@/utils/formatters';
import { RuleBadgeChip, badgeOfRule, ruleText } from '../utils/ruleText';
import { SummaryInlineRow } from './EntityPanelShared';
import { useExplorerEntity } from './ExplorerEntityCard';
import { HeldResourcesList } from './HeldResourcesList';
import { CopyButton, PlainSummary } from './SummaryCardKit';

/**
 * What a locker holds and has done, for the explorer: the shared reader,
 * once the Gateway confirms the address is a locker.
 */
export function useLockerActivity(address: string, network: Network) {
    const { data } = useExplorerEntity(address, network);
    return useSharedLockerActivity(address, network, !!data && !!parseLockerState(data));
}

/**
 * A locker in detail: what it holds now (with symbols), its counts, who can
 * deposit and recover, and each recipient with what is still waiting for them.
 * The locker card's Contents tab, and an account's locker rows when unfolded.
 * Recipients are one table: who, what still waits for them, and how to claim it.
 */
export function LockerDetails({
    address,
    network,
    locale,
    copiedAddress,
    onCopy,
    account,
}: {
    address: string;
    network: Network;
    locale: string;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
    /** The account the locker is opened from: its row is marked and comes first. */
    account?: string;
}) {
    const c = useLanguage().t.dashboard?.entity_cards;
    const l = c?.locker;
    const { data } = useExplorerEntity(address, network);
    const locker = data ? parseLockerState(data) : null;
    const { data: activity, isLoading, isError } = useLockerActivity(address, network);

    // Recipients, the account it is opened from first, and what still waits
    // for each (the first few: one request each).
    const all = activity?.claimantAccounts ?? [];
    const recipients = (account && all.includes(account) ? [account, ...all.filter((a) => a !== account)] : all).slice(0, MAX_LOCKER_RECIPIENTS);
    const { data: waiting } = useLockerWaiting(address, recipients, network);

    const held = Object.keys(activity?.fungibles ?? {});
    const heldNfts = Object.keys(activity?.nonFungibles ?? {});
    const roleBadges = locker ? [badgeOfRule(locker.storer), badgeOfRule(locker.recoverer)] : [];
    const waitingResources = Object.values(waiting ?? {}).flatMap((claims) => claims.map((claim) => claim.resource));
    const names = useResourceLabels([...roleBadges, ...waitingResources], network);
    const copyTitle = c?.copy ?? 'Copy';

    // What it holds, as rows: fungibles by amount, non-fungibles by count.
    const heldItems = [
        ...held.map((resource) => ({ resource_address: resource, amount: activity?.fungibles[resource] ?? '0' })),
        ...heldNfts.map((resource) => ({ resource_address: resource, amount: String(activity?.nonFungibles[resource] ?? 0) })),
    ];
    const roleValue = (rule: RuleView) => (
        <>
            <span className="text-xs font-semibold text-[var(--color-text-main)]">{ruleText(rule, c?.rules, names)}</span>
            <RuleBadgeChip rule={rule} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
        </>
    );
    const sectionTitle = 'text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]';

    return (
        <div className="space-y-4">
            {isLoading && <PlainSummary>{l?.loading}</PlainSummary>}
            {isError && <PlainSummary>{l?.error}</PlainSummary>}
            {activity?.truncated && <PlainSummary>{(l?.truncated ?? '').replace('{count}', String(LOCKER_HISTORY_PAGES * 100))}</PlainSummary>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
                {activity &&
                    (heldItems.length === 0 ? (
                        <div className="flex flex-col gap-1">
                            <h4 className={sectionTitle}>{l?.holds_now ?? 'Holding now'}</h4>
                            <p className="py-2.5 text-sm text-[var(--color-text-muted)]">{l?.nothing ?? 'Empty'}</p>
                        </div>
                    ) : (
                        <HeldResourcesList
                            title={l?.holds_now ?? 'Holding now'}
                            items={heldItems}
                            network={network}
                            locale={locale}
                            copiedAddress={copiedAddress}
                            onCopy={onCopy}
                            copyTitle={copyTitle}
                            detail={(resource) => (heldNfts.includes(resource) ? 'NFT' : null)}
                        />
                    ))}

                <dl>
                    {activity && (
                        <>
                            <SummaryInlineRow label={l?.claimants ?? 'Recipients'} value={String(activity.claimants)} />
                            <SummaryInlineRow label={l?.stores ?? 'Deposits'} value={String(activity.stores)} />
                            <SummaryInlineRow label={l?.claims ?? 'Claimed'} value={String(activity.claims)} />
                            <SummaryInlineRow label={l?.recoveries ?? 'Recovered'} value={String(activity.recoveries)} />
                        </>
                    )}
                    {locker && (
                        <>
                            <SummaryInlineRow label={l?.storer ?? 'Can deposit'}>{roleValue(locker.storer)}</SummaryInlineRow>
                            <SummaryInlineRow label={l?.recoverer ?? 'Can recover'}>{roleValue(locker.recoverer)}</SummaryInlineRow>
                        </>
                    )}
                </dl>
            </div>

            {recipients.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                                <th className="py-2 pr-4 text-left font-semibold">{l?.recipient ?? 'Recipient'}</th>
                                <th className="py-2 pr-4 text-left font-semibold">{l?.pending ?? 'To claim'}</th>
                                <th className="py-2" aria-hidden />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-card-border)] border-t border-[var(--color-card-border)]">
                            {recipients.map((recipient) => {
                                const pending = waiting?.[recipient];
                                const isAccount = recipient === account;
                                return (
                                    <tr key={recipient} className={isAccount ? 'bg-[var(--color-primary)]/5' : ''}>
                                        <td className="py-2.5 pr-4 align-middle">
                                            <span className="flex items-center gap-1 whitespace-nowrap">
                                                <Link
                                                    href={dashboardRoutes.entity(locale, recipient, { network })}
                                                    className="font-mono text-[var(--color-primary)] hover:underline"
                                                    title={recipient}
                                                >
                                                    {recipient.slice(0, 14)}…{recipient.slice(-6)}
                                                </Link>
                                                <CopyButton value={recipient} copiedAddress={copiedAddress} onCopy={onCopy} title={copyTitle} />
                                            </span>
                                            {isAccount && <span className="block text-[10px] font-bold text-[var(--color-primary)]">{l?.this_account ?? 'This account'}</span>}
                                        </td>
                                        <td className="py-2.5 pr-4 align-middle">
                                            {!pending ? (
                                                <span className="text-[var(--color-text-muted)]">…</span>
                                            ) : pending.length ? (
                                                <ul className="space-y-0.5">
                                                    {pending.map((claim) => (
                                                        <li key={claim.resource} className="font-mono font-semibold tabular-nums text-[var(--color-text-main)] whitespace-nowrap">
                                                            {claim.nftIds ? `${claim.nftIds.length} NFT` : formatNumber(Number(claim.amount ?? 0), 6, locale)}{' '}
                                                            <span className="font-sans text-[var(--color-text-muted)]">{names[claim.resource] ?? '?'}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="text-[var(--color-text-muted)]">{l?.all_claimed ?? 'All claimed'}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 text-right align-middle whitespace-nowrap">
                                            {pending?.length ? (
                                                // A full page load: the console reads its query when it opens.
                                                <a
                                                    href={`/${locale}/console/locker-claim?locker=${address}&account=${recipient}`}
                                                    className="font-bold text-[var(--color-primary)] hover:underline"
                                                >
                                                    {l?.claim ?? 'Claim in the console'} →
                                                </a>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {(activity?.claimantAccounts.length ?? 0) > MAX_LOCKER_RECIPIENTS && (
                        <p className="pt-2 text-[11px] text-[var(--color-text-muted)]">
                            {(l?.more_recipients ?? 'And {count} more recipients.').replace('{count}', String((activity?.claimantAccounts.length ?? 0) - MAX_LOCKER_RECIPIENTS))}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
