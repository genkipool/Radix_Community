'use client';

import React from 'react';
import { ArrowRight, Landmark, Lock, ShieldCheck, Server, UserRound, Percent, KeyRound, Power, Users, Hourglass, Unlock, type LucideIcon } from 'lucide-react';
import { AddressDisplay } from './EntityBadge';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { SummaryCard, SummaryHero, SummaryBody, PlainSummary, FactTile, FactGrid } from './SummaryCardKit';
import { EPOCH_MS, type OwnerAction } from '../utils/validatorOwnerActions';
import type { Network, TranslationsT } from '@/features/dashboard/types';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

interface ValidatorOwnerActionCardProps {
    action: OwnerAction;
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

const ICONS: Record<OwnerAction['kind'], LucideIcon> = {
    start_unlock: Unlock, finish_unlock: Unlock, lock: Lock,
    register: Power, unregister: Power, update_key: KeyRound, update_fee: Percent, accept_delegated: Users,
};

/** Origin → destination, laid out like the delegator's unstake card: where the LSUs were, where they are now. */
function Flow({ fromLabel, fromValue, fromHint, toLabel, toValue, toHint }: {
    fromLabel: string; fromValue: React.ReactNode; fromHint?: React.ReactNode;
    toLabel: string; toValue: React.ReactNode; toHint?: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-1 @lg:grid-cols-[1fr_auto_1fr] items-stretch gap-3">
            <div className="rounded-xl border border-[var(--color-card-border)] bg-blue-500/5 p-3">
                <h5 className="text-[10px] uppercase font-black tracking-widest text-blue-600 mb-2 flex items-center gap-1.5 opacity-80">
                    <Landmark className="size-3" />{fromLabel}
                </h5>
                <div className="text-xl font-black text-orange-600 dark:text-orange-400 tabular-nums">{fromValue}</div>
                {fromHint && <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">{fromHint}</div>}
            </div>
            <div className="grid place-items-center text-[var(--color-text-muted)]" aria-hidden="true">
                <ArrowRight className="size-5 rotate-90 @lg:rotate-0" />
            </div>
            <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-accent)]/5 p-3">
                <h5 className="text-[10px] uppercase font-black tracking-widest text-[var(--color-accent)] mb-2 flex items-center gap-1.5 opacity-80">
                    <Landmark className="size-3" />{toLabel}
                </h5>
                <div className="text-xl font-black text-[var(--color-accent)] tabular-nums">{toValue}</div>
                {toHint && <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">{toHint}</div>}
            </div>
        </div>
    );
}

/** A before → after pair of values. */
function Change({ before, after, mono = false }: { before: React.ReactNode; after: React.ReactNode; mono?: boolean }) {
    return (
        <span className={`flex flex-wrap items-center gap-2 ${mono ? 'font-mono text-xs' : ''}`}>
            <span className="text-[var(--color-text-muted)] line-through decoration-1">{before}</span>
            <ArrowRight className="size-3.5 text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
            <span className="font-black text-[var(--color-accent)]">{after}</span>
        </span>
    );
}

/**
 * ValidatorOwnerActionCard
 * Explains what a validator's owner did to the validator: unlocking or locking
 * their own stake, registering, rotating the key, setting the fee. The unlock
 * flow wears the same origin → destination layout as a delegator's unstake.
 */
export function ValidatorOwnerActionCard({ action, owner, confirmedAt, tt, onCopy, copiedAddress, network, locale = 'en', timezone }: ValidatorOwnerActionCardProps) {
    const Icon = ICONS[action.kind];
    const fmt = (n: number) => parseFloat(n.toFixed(4)).toLocaleString(locale, { maximumFractionDigits: 4 });
    const percent = (fraction: number) => `${parseFloat((fraction * 100).toFixed(4)).toLocaleString(locale, { maximumFractionDigits: 4 })} %`;
    const dateAt = (epochsAway: number) => {
        const base = confirmedAt ? new Date(confirmedAt).getTime() : NaN;
        return Number.isFinite(base)
            ? new Date(base + epochsAway * EPOCH_MS).toLocaleString(locale, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : null;
    };
    const t = (key: string, fallback: string) => (tt as Record<string, string> | undefined)?.[key] ?? fallback;
    // The validator by its name when it is known; the summary reads better than with an address.
    const validatorName = useEntityData(action.validator, network)?.name || shortValidator(action.validator);
    const amount = action.amount !== undefined ? fmt(action.amount) : '—';
    const unlockDate = action.unlockEpochsAway !== undefined ? dateAt(action.unlockEpochsAway) : null;
    const days = action.unlockEpochsAway !== undefined ? Math.round((action.unlockEpochsAway * EPOCH_MS) / 86_400_000) : null;

    const summary = (() => {
        switch (action.kind) {
            case 'start_unlock':
                return unlockDate
                    ? fill(t('owner_summary_start_unlock', 'The owner of {validator} asked to unlock {amount} LSU of the stake locked in the validator. They wait in a vault until {date}; only then can they be taken out, sold or unstaked.'), { validator: validatorName, amount, date: unlockDate })
                    : fill(t('owner_summary_start_unlock_nodate', 'The owner of {validator} asked to unlock {amount} LSU of the stake locked in the validator. They wait in a vault until the unlock delay passes.'), { validator: validatorName, amount });
            case 'finish_unlock':
                return fill(t('owner_summary_finish_unlock', 'The owner of {validator} took {amount} LSU out of unlocking. They are now in the owner account, free to hold, sell or unstake.'), { validator: validatorName, amount });
            case 'lock':
                return fill(t('owner_summary_lock', 'The owner of {validator} locked {amount} LSU as stake of their own in the validator. While locked they cannot be moved.'), { validator: validatorName, amount });
            case 'register':
                return fill(t('owner_summary_register', '{validator} registered: it can now be considered for the active validator set.'), { validator: validatorName });
            case 'unregister':
                return fill(t('owner_summary_unregister', '{validator} unregistered: it stops being a candidate for the active validator set until it registers again.'), { validator: validatorName });
            case 'update_key':
                return fill(t('owner_summary_update_key', 'The consensus key of {validator} was replaced. Its node has to run with the new key.'), { validator: validatorName });
            case 'update_fee':
                return fill(action.fee?.appliedNow
                    ? t('owner_summary_fee_now', 'The owner of {validator} set the fee to {fee}, applied immediately.')
                    : t('owner_summary_fee_later', 'The owner of {validator} asked for a fee of {fee}; it takes effect at epoch {epoch}.'),
                { validator: validatorName, fee: action.fee ? percent(action.fee.requested) : '—', epoch: action.fee?.effectiveEpoch ?? '—' });
            case 'accept_delegated':
                return fill(action.accepts?.after
                    ? t('owner_summary_accept_on', '{validator} now accepts delegated stake: anyone can stake to it.')
                    : t('owner_summary_accept_off', '{validator} no longer accepts new delegated stake; current delegators keep their stake and can still unstake.'),
                { validator: validatorName });
        }
    })();

    return (
        <SummaryCard
            icon={ShieldCheck}
            title={t('owner_title', 'Validator owner action')}
            aside={
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    {t(`owner_action_${action.kind}`, action.kind)}
                </span>
            }
        >
            <SummaryHero>
                <FactGrid>
                    <FactTile icon={Server} label={t('owner_validator', 'Validator')}>
                        <AddressDisplay label={t('owner_validator', 'Validator')} address={action.validator} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel />
                    </FactTile>
                    {owner && (
                        <FactTile icon={UserRound} label={t('owner_owner', 'Owner account')}>
                            <AddressDisplay label={t('owner_owner', 'Owner account')} address={owner} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} network={network} hideLabel />
                        </FactTile>
                    )}
                    <FactTile icon={Icon} label={t('owner_action', 'Action')}>
                        {t(`owner_action_${action.kind}`, action.kind)}
                    </FactTile>
                </FactGrid>
            </SummaryHero>

            <SummaryBody>
                {action.kind === 'start_unlock' && (
                    <Flow
                        fromLabel={t('owner_locked_vault', 'Locked owner stake')}
                        fromValue={`−${amount} LSU`}
                        toLabel={t('owner_unlocking_vault', 'Unlocking')}
                        toValue={`+${amount} LSU`}
                        toHint={unlockDate && days !== null
                            ? fill(t('owner_available_on', 'Available {date} (epoch {epoch}, in about {days} days)'), { date: unlockDate, epoch: action.unlockEpoch ?? '—', days })
                            : t('owner_available_later', 'Available once the unlock delay passes')}
                    />
                )}
                {action.kind === 'finish_unlock' && (
                    <Flow
                        fromLabel={t('owner_unlocking_vault', 'Unlocking')}
                        fromValue={`−${amount} LSU`}
                        toLabel={t('owner_owner', 'Owner account')}
                        toValue={`+${amount} LSU`}
                        toHint={t('owner_free', 'Free to hold, sell or unstake')}
                    />
                )}
                {action.kind === 'lock' && (
                    <Flow
                        fromLabel={t('owner_owner', 'Owner account')}
                        fromValue={`−${amount} LSU`}
                        toLabel={t('owner_locked_vault', 'Locked owner stake')}
                        toValue={`+${amount} LSU`}
                        toHint={t('owner_locked_hint', 'Stays locked until the owner starts unlocking it')}
                    />
                )}

                {action.kind === 'start_unlock' && action.unlockingTotal !== undefined && action.unlockingParts !== undefined && (
                    <FactGrid>
                        <FactTile icon={Hourglass} label={t('owner_unlocking_now', 'Unlocking now')}>
                            {fill(t('owner_unlocking_total', '{amount} LSU in {parts} parts'), { amount: fmt(action.unlockingTotal), parts: action.unlockingParts })}
                        </FactTile>
                    </FactGrid>
                )}

                {(action.kind === 'register' || action.kind === 'unregister') && action.registered && (
                    <FactGrid>
                        <FactTile icon={Power} label={t('owner_registration', 'Registration')}>
                            <Change
                                before={action.registered.before === null ? '—' : action.registered.before ? t('owner_registered', 'Registered') : t('owner_not_registered', 'Not registered')}
                                after={action.registered.after === null ? '—' : action.registered.after ? t('owner_registered', 'Registered') : t('owner_not_registered', 'Not registered')}
                            />
                        </FactTile>
                    </FactGrid>
                )}

                {action.kind === 'update_key' && action.key && (
                    <FactGrid>
                        <FactTile icon={KeyRound} label={t('owner_key', 'Consensus key')}>
                            <Change before={shortKey(action.key.before)} after={shortKey(action.key.after)} mono />
                        </FactTile>
                    </FactGrid>
                )}

                {action.kind === 'update_fee' && action.fee && (
                    <FactGrid>
                        <FactTile icon={Percent} label={t('owner_fee', 'Validator fee')}>
                            <Change before={action.fee.before === null ? '—' : percent(action.fee.before)} after={percent(action.fee.requested)} />
                        </FactTile>
                        <FactTile icon={Hourglass} label={t('owner_fee_effective', 'Takes effect')}>
                            {action.fee.appliedNow
                                ? t('owner_fee_immediate', 'Applied immediately')
                                : fill(t('owner_fee_epoch', 'Epoch {epoch}'), { epoch: action.fee.effectiveEpoch ?? '—' })}
                        </FactTile>
                    </FactGrid>
                )}

                {action.kind === 'accept_delegated' && action.accepts && (
                    <FactGrid>
                        <FactTile icon={Users} label={t('owner_accepts', 'Accepts delegated stake')}>
                            <Change
                                before={action.accepts.before === null ? '—' : action.accepts.before ? t('owner_yes', 'Yes') : t('owner_no', 'No')}
                                after={action.accepts.after ? t('owner_yes', 'Yes') : t('owner_no', 'No')}
                            />
                        </FactTile>
                    </FactGrid>
                )}

                <PlainSummary>{summary}</PlainSummary>
            </SummaryBody>
        </SummaryCard>
    );
}

const shortValidator = (address: string) => (address.length > 22 ? `${address.slice(0, 14)}…${address.slice(-6)}` : address);
