'use client';

import React from 'react';
import { ArrowRight, Check, Copy, Hourglass, Info, KeyRound, Lock, Percent, Power, ShieldCheck, Unlock, Users, type LucideIcon } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { AddressDisplay } from './EntityBadge';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { SummaryCard } from './SummaryCardKit';
import { EPOCH_MS, type OwnerAction } from '../utils/validatorOwnerActions';
import type { Network, TranslationsT } from '@/features/dashboard/types';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

interface ValidatorOwnerActionCardProps {
    /** Everything the owner did to this validator in the transaction. */
    actions: OwnerAction[];
    /** The account that presented the owner badge. */
    owner: string | null;
    /** When the transaction was confirmed, to put a date on an unlock a few epochs away. */
    confirmedAt?: string;
    tt?: Tt;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale?: string;
    timezone?: string;
}

/** Fills `{name}` placeholders of a translated sentence. */
const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

const shortKey = (hex: string | null) => (hex ? `${hex.slice(0, 10)}…${hex.slice(-8)}` : '—');
const shortValidator = (address: string) => (address.length > 22 ? `${address.slice(0, 14)}…${address.slice(-6)}` : address);

/** One thing that changed: what it is, its value in large type, a line of context underneath. */
interface Item {
    key: string;
    icon: LucideIcon;
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
}

/** A before → after pair of values. */
function Change({ before, after, mono = false }: { before: React.ReactNode; after: React.ReactNode; mono?: boolean }) {
    return (
        <span className={`inline-flex flex-wrap items-center gap-x-2 ${mono ? 'font-mono text-sm' : ''}`}>
            <span className="font-semibold text-[var(--color-text-muted)] line-through decoration-1">{before}</span>
            <ArrowRight className="size-4 text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
            <span className="text-[var(--color-accent)]">{after}</span>
        </span>
    );
}

/**
 * ValidatorOwnerActionCard
 * One card for everything a validator's owner did to a validator in a
 * transaction: who it is, then each change laid out on a shared grid —
 * unlocking or locking their own stake, registering, rotating the key,
 * setting the fee — and a sentence for each.
 */
export function ValidatorOwnerActionCard({ actions, owner, confirmedAt, tt, onCopy, copiedAddress, network, locale = 'en', timezone }: ValidatorOwnerActionCardProps) {
    const validator = actions[0].validator;
    const entity = useEntityData(validator, network);
    const name = entity?.name || shortValidator(validator);
    const iconUrl = entity?.iconUrl;

    const t = (key: string, fallback: string) => (tt as Record<string, string> | undefined)?.[key] ?? fallback;
    const fmt = (n: number) => parseFloat(n.toFixed(4)).toLocaleString(locale, { maximumFractionDigits: 4 });
    const percent = (fraction: number) => `${parseFloat((fraction * 100).toFixed(4)).toLocaleString(locale, { maximumFractionDigits: 4 })} %`;
    const dateAt = (epochsAway: number) => {
        const base = confirmedAt ? new Date(confirmedAt).getTime() : NaN;
        return Number.isFinite(base)
            ? new Date(base + epochsAway * EPOCH_MS).toLocaleString(locale, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : null;
    };
    const stateLabel = (value: boolean | null, yes: string, no: string) => (value === null ? '—' : value ? yes : no);
    const registered = t('owner_registered', 'Registered');
    const notRegistered = t('owner_not_registered', 'Not registered');

    /** The items and the sentence of one action. */
    const describe = (action: OwnerAction): { items: Item[]; summary: string } => {
        const amount = action.amount !== undefined ? fmt(action.amount) : '—';
        const unlockDate = action.unlockEpochsAway !== undefined ? dateAt(action.unlockEpochsAway) : null;
        const days = action.unlockEpochsAway !== undefined ? Math.round((action.unlockEpochsAway * EPOCH_MS) / 86_400_000) : null;
        const sentence = (key: string, fallback: string, values: Record<string, string | number> = {}) => fill(t(key, fallback), { validator: name, ...values });

        switch (action.kind) {
            case 'start_unlock': {
                const items: Item[] = [{
                    key: 'amount', icon: Unlock, label: t('owner_unlock_amount', 'Owner stake'),
                    value: `${amount} LSU`,
                    hint: <>{t('owner_locked_vault', 'Locked')}<ArrowRight className="mx-1 inline size-3 align-[-2px]" aria-hidden="true" />{t('owner_unlocking_vault', 'Unlocking')}</>,
                }];
                if (action.unlockingTotal !== undefined && action.unlockingParts !== undefined) {
                    items.push({
                        key: 'now', icon: Lock, label: t('owner_unlocking_now', 'Unlocking now'),
                        value: `${fmt(action.unlockingTotal)} LSU`,
                        hint: action.unlockingParts === 1
                            ? t('owner_in_one_part', 'in 1 part')
                            : fill(t('owner_in_parts', 'in {parts} parts'), { parts: action.unlockingParts }),
                    });
                }
                // Last, so on a row of three it is the third column.
                items.push({
                    key: 'available', icon: Hourglass, label: t('owner_available', 'Available from'),
                    value: unlockDate ?? t('owner_available_later', 'Once the unlock delay passes'),
                    hint: days !== null ? fill(t('owner_available_hint', 'Epoch {epoch} · in about {days} days'), { epoch: action.unlockEpoch ?? '—', days }) : undefined,
                });
                return {
                    items,
                    summary: unlockDate
                        ? sentence('owner_summary_start_unlock', 'The owner of {validator} asked to unlock {amount} LSU of the stake locked in the validator. They wait in a vault until {date}; only then can they be taken out, sold or unstaked.', { amount, date: unlockDate })
                        : sentence('owner_summary_start_unlock_nodate', 'The owner of {validator} asked to unlock {amount} LSU of the stake locked in the validator. They wait in a vault until the unlock delay passes.', { amount }),
                };
            }
            case 'finish_unlock':
                return {
                    items: [{ key: 'amount', icon: Unlock, label: t('owner_owner', 'Owner account'), value: `+${amount} LSU`, hint: t('owner_free', 'Free to hold, sell or unstake') }],
                    summary: sentence('owner_summary_finish_unlock', 'The owner of {validator} took {amount} LSU out of unlocking. They are now in the owner account, free to hold, sell or unstake.', { amount }),
                };
            case 'lock':
                return {
                    items: [{ key: 'amount', icon: Lock, label: t('owner_locked_vault', 'Locked owner stake'), value: `+${amount} LSU`, hint: t('owner_locked_hint', 'Stays locked until the owner starts unlocking it') }],
                    summary: sentence('owner_summary_lock', 'The owner of {validator} locked {amount} LSU as stake of their own in the validator. While locked they cannot be moved.', { amount }),
                };
            case 'register':
            case 'unregister':
                return {
                    items: action.registered ? [{
                        key: 'registration', icon: Power, label: t('owner_registration', 'Registration'),
                        value: <Change before={stateLabel(action.registered.before, registered, notRegistered)} after={stateLabel(action.registered.after, registered, notRegistered)} />,
                    }] : [],
                    summary: action.kind === 'register'
                        ? sentence('owner_summary_register', '{validator} registered: it can now be considered for the active validator set.')
                        : sentence('owner_summary_unregister', '{validator} unregistered: it stops being a candidate for the active validator set until it registers again.'),
                };
            case 'update_key':
                return {
                    items: action.key ? [{
                        key: 'key', icon: KeyRound, label: t('owner_key', 'Consensus key'),
                        value: <Change before={shortKey(action.key.before)} after={shortKey(action.key.after)} mono />,
                    }] : [],
                    summary: sentence('owner_summary_update_key', 'The consensus key of {validator} was replaced. Its node has to run with the new key.'),
                };
            case 'update_fee': {
                const fee = action.fee;
                return {
                    items: fee ? [{
                        key: 'fee', icon: Percent, label: t('owner_fee', 'Validator fee'),
                        value: <Change before={fee.before === null ? '—' : percent(fee.before)} after={percent(fee.requested)} />,
                        hint: fee.appliedNow
                            ? t('owner_fee_immediate', 'Applied immediately')
                            : `${t('owner_fee_effective', 'Takes effect')}: ${fill(t('owner_fee_epoch', 'Epoch {epoch}'), { epoch: fee.effectiveEpoch ?? '—' })}`,
                    }] : [],
                    summary: fee?.appliedNow
                        ? sentence('owner_summary_fee_now', 'The owner of {validator} set the fee to {fee}, applied immediately.', { fee: percent(fee.requested) })
                        : sentence('owner_summary_fee_later', 'The owner of {validator} asked for a fee of {fee}; it takes effect at epoch {epoch}.', { fee: fee ? percent(fee.requested) : '—', epoch: fee?.effectiveEpoch ?? '—' }),
                };
            }
            case 'accept_delegated': {
                const yes = t('owner_yes', 'Yes');
                const no = t('owner_no', 'No');
                return {
                    items: action.accepts ? [{
                        key: 'accepts', icon: Users, label: t('owner_accepts', 'Accepts delegated stake'),
                        value: <Change before={stateLabel(action.accepts.before, yes, no)} after={stateLabel(action.accepts.after, yes, no)} />,
                    }] : [],
                    summary: action.accepts?.after
                        ? sentence('owner_summary_accept_on', '{validator} now accepts delegated stake: anyone can stake to it.')
                        : sentence('owner_summary_accept_off', '{validator} no longer accepts new delegated stake; current delegators keep their stake and can still unstake.'),
                };
            }
        }
    };

    const described = actions.map(describe);
    const items = described.flatMap(d => d.items);
    const titles = actions.map(a => t(`owner_action_${a.kind}`, a.kind));

    return (
        <SummaryCard icon={ShieldCheck} title={t('owner_title', 'Validator owner action')}>
            {/* Who: the validator with its picture, and the owner account that acted */}
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-4 @md:p-5 bg-gradient-to-br from-[var(--color-primary)]/10 via-transparent to-[var(--color-secondary)]/10">
                <div className="flex min-w-0 items-center gap-4">
                    <div className="size-14 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-sm">
                        <SafeImage src={iconUrl ?? ''} alt={name} fallbackName={name} className="size-full object-cover" />
                    </div>
                    <div className="min-w-0 space-y-1">
                        <p className="truncate text-lg font-black leading-tight text-[var(--color-text-main)]">{name}</p>
                        {/* The name is above, so the address is shown on its own with its copy button */}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onCopy(validator); }}
                            title={validator}
                            className="flex max-w-full items-center gap-1.5 font-mono text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
                        >
                            <span className="truncate">{shortValidator(validator)}</span>
                            {copiedAddress === validator ? <Check className="size-3.5 shrink-0 text-green-500" /> : <Copy className="size-3.5 shrink-0" />}
                        </button>
                        <p className="text-xs font-bold text-[var(--color-primary)]">{titles.join(' · ')}</p>
                    </div>
                </div>
                {owner && (
                    <div className="min-w-0 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{t('owner_owner', 'Owner account')}</p>
                        <div className="text-sm font-semibold"><AddressDisplay label={t('owner_owner', 'Owner account')} address={owner} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel /></div>
                    </div>
                )}
            </div>

            <div className="border-t border-[var(--color-card-border)] px-4 @md:px-5">
                {/* What changed: every change on one grid, two to a row when there is room */}
                {items.length > 0 && (
                    <dl className={`grid grid-cols-1 gap-x-10 ${items.length % 3 === 0 ? '@2xl:grid-cols-3' : '@2xl:grid-cols-2'}`}>
                        {items.map(({ key, icon: Icon, label, value, hint }, i) => (
                            <div
                                key={`${key}-${i}`}
                                className={`flex min-w-0 flex-col gap-1 border-b border-[var(--color-card-border)] py-3.5 ${items.length % 3 !== 0 && items.length % 2 === 1 && i === items.length - 1 ? '@2xl:col-span-2 @2xl:flex-row @2xl:items-center @2xl:justify-between' : ''}`}
                            >
                                <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                                    <Icon className="size-3.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                                    {label}
                                </dt>
                                <dd className="min-w-0">
                                    <div className="text-xl font-black leading-snug tabular-nums text-[var(--color-text-main)]">{value}</div>
                                    {hint && <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hint}</div>}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}

                {/* In words: one sentence per change */}
                <ul className="space-y-2 py-4">
                    {described.map(({ summary }, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
                            <Info className="mt-0.5 size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                            <span>{summary}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </SummaryCard>
    );
}
