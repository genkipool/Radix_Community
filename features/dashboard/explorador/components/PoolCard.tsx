'use client';
import { Waves } from 'lucide-react';

import { useResourceLabels } from '@/features/console/hooks/useResourceLabels';
import { isDrainable, parsePoolState, redemptionValue, type PoolState } from '@/features/console/lib/pool-lookup';
import { RETIRED_TAG } from '@/features/console/lib/pool-manifests';
import type { RuleView } from '@/features/console/lib/role-lookup';
import { formatNumber } from '@/utils/formatters';
import type { AccountCardProps } from '../types/components.types';
import { RuleBadgeChip, badgeOfRule, ruleText } from '../utils/ruleText';
import { ExplorerEntityCard, STATUS_CLASS, entityMeta, useExplorerEntity, type EntityFact } from './ExplorerEntityCard';
import { HeldResourcesList } from './HeldResourcesList';
import { PoolParticipants } from './PoolParticipants';
import { SummaryInlineRow } from './EntityPanelShared';
import { AddressChip, PlainSummary } from './SummaryCardKit';

const amount = (value: number | string, locale: string) => formatNumber(Number(value), 6, locale);

/** Reserves by symbol, e.g. "4 XRD · 400 DA". */
const reservesLine = (pool: PoolState, names: Record<string, string>, locale: string) =>
    pool.resources.map((r) => `${amount(pool.reserves[r] ?? '0', locale)} ${names[r] ?? '?'}`).join(' · ');

/**
 * A native pool: what it holds, how many units are out, and whether it is in
 * use. Its own tab lists each reserve with what one unit redeems for, and who
 * holds the manager and owner roles. The pool state is read by the console's
 * parser, so the explorer and the console's pool tools never disagree.
 */
export function PoolCard(props: AccountCardProps) {
    const { address, network, locale, copiedAddress, onCopy } = props;
    const c = props.t?.dashboard?.entity_cards;
    const p = c?.pool;
    const { data } = useExplorerEntity(address, network);
    const pool = data ? parsePoolState(data) : null;
    const { data: unit } = useExplorerEntity(pool?.poolUnit ?? '', network);
    const roleBadges = pool ? [badgeOfRule(pool.manager), badgeOfRule(pool.owner)] : [];
    const names = useResourceLabels([...(pool?.resources ?? []), ...roleBadges], network);
    const { getMeta } = entityMeta(data);

    // Not a native pool after all (a component whose address happens to start
    // with pool_ cannot exist, but the Gateway answer is the authority).
    if (!pool) return <ExplorerEntityCard {...props} icon={Waves} facts={[]} />;

    const supply = Number((unit?.details as Record<string, unknown> | undefined)?.total_supply ?? 0);
    const unitMeta = entityMeta(unit);
    const perUnit = redemptionValue(pool.reserves, 1, supply);
    const empty = pool.resources.every((r) => !(Number(pool.reserves[r]) > 0));
    const retired = pool.tags.includes(RETIRED_TAG);
    const drainable = isDrainable(pool);
    const status: EntityFact = drainable
        ? { label: p?.status ?? 'Status', value: p?.drainable ?? 'Drainable by anyone', tone: 'danger' }
        : { label: p?.status ?? 'Status', value: retired ? p?.retired ?? 'Retired' : empty ? p?.empty ?? 'Empty' : p?.active ?? 'Active', tone: retired ? 'main' : 'green' };

    const facts: EntityFact[] = [
        { label: c?.name ?? 'Name', value: getMeta('name') || pool.resources.map((r) => names[r] ?? '?').join('/'), tone: 'accent' },
        { label: c?.type ?? 'Type', value: p?.kinds[pool.kind] ?? pool.kind, tone: 'secondary' },
        { label: p?.reserves ?? 'Reserves', value: reservesLine(pool, names, locale), title: reservesLine(pool, names, locale), tone: 'primary' },
        { label: p?.units ?? 'Units in circulation', value: amount(supply, locale), tone: 'blue' },
        status,
    ];

    const copyTitle = c?.copy ?? 'Copy';
    // Every pool resource, in the pool's order, with its Gateway metadata when it has a vault.
    const reserveItems = pool.resources.map(
        (resource) =>
            data?.fungible_resources?.items.find((item) => item.resource_address === resource) ?? {
                resource_address: resource,
                amount: pool.reserves[resource] ?? '0',
            },
    );
    /** A role in words, with its badge address under it when it names one. */
    const roleValue = (rule: RuleView, danger = false) => (
        <span className="flex min-w-0 flex-col items-end gap-0.5">
            <span className={`max-w-full truncate text-xs font-semibold ${danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-main)]'}`} title={ruleText(rule, c?.rules, names)}>
                {ruleText(rule, c?.rules, names)}
            </span>
            <RuleBadgeChip rule={rule} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
        </span>
    );

    const reservesTab = () => (
        <div className="space-y-4">
            {drainable && <PlainSummary>{p?.drainable_warning}</PlainSummary>}
            {retired && <PlainSummary>{p?.retired_note}</PlainSummary>}

            {/* Reserves and the pool's facts side by side, the same height. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-x-10 gap-y-4">
                <HeldResourcesList
                    fill
                    network={network}
                    title={p?.reserves ?? 'Reserves'}
                    items={reserveItems}
                    locale={locale}
                    copiedAddress={copiedAddress}
                    onCopy={onCopy}
                    copyTitle={copyTitle}
                    detail={(resource, symbol) =>
                        `${p?.per_unit ?? 'Per unit'}: ${amount(perUnit[resource] ?? 0, locale)} ${symbol || names[resource] || ''}`.trim()
                    }
                />

                <div className="flex h-full flex-col gap-1">
                    <h4 className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">{p?.facts ?? 'The pool'}</h4>
                    <dl className="flex flex-1 flex-col [&>div]:flex-1">
                        <SummaryInlineRow label={status.label}>
                            <span className={`text-xs font-bold ${STATUS_CLASS[status.tone ?? 'main']}`}>{status.value}</span>
                        </SummaryInlineRow>
                        <SummaryInlineRow label={p?.pool_unit ?? 'Pool unit'}>
                            <span className="text-xs text-[var(--color-text-muted)]">
                                {(p?.in_circulation ?? '{count} in circulation').replace('{count}', amount(supply, locale))}
                            </span>
                            <AddressChip address={pool.poolUnit} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                        </SummaryInlineRow>
                        <SummaryInlineRow label={p?.manager ?? 'Manager'}>
                            {roleValue(pool.manager, drainable)}
                        </SummaryInlineRow>
                        <SummaryInlineRow label={p?.owner ?? 'Owner'}>
                            <span className="text-xs text-[var(--color-text-muted)]">
                                {pool.ownerUpdatable ? p?.owner_updatable ?? 'Can be changed' : p?.owner_frozen ?? 'Frozen'}
                            </span>
                            {roleValue(pool.owner)}
                        </SummaryInlineRow>
                    </dl>
                </div>
            </div>

            <PoolParticipants
                pool={pool}
                supply={supply}
                unitSymbol={unitMeta.getMeta('symbol') || unitMeta.getMeta('name')}
                names={names}
                network={network}
                locale={locale}
                copiedAddress={copiedAddress}
                onCopy={onCopy}
            />
        </div>
    );


    return (
        <ExplorerEntityCard
            {...props}
            icon={Waves}
            facts={facts}
            extraTabs={[{ key: 'reserves', label: p?.reserves_tab ?? 'Reserves', tooltip: p?.reserves_tab_tooltip, render: reservesTab }]}
        />
    );
}
