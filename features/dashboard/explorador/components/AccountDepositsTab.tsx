'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Ban, BadgeCheck, CheckCircle2, Inbox, type LucideIcon } from 'lucide-react';

import { SafeImage } from '@/components/ui/SafeImage';
import { useDepositSettings } from '@/features/console/hooks/useDepositSettings';
import type { DefaultDepositRule, DepositSettings, ResourcePreference } from '@/features/console/lib/account-deposits';
import { getMetadataString, type GatewayMetadataItem } from '@/features/console/lib/metadata-manifests';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import { formatNumber } from '@/utils/formatters';
import { mapHoldings } from '@/features/console/lib/account-holdings';
import { isNonFungibleResource } from '@/features/console/lib/bulk-send';
import { sumDecimals } from '@/features/console/lib/decimal';
import { useAccountLockers } from './AccountLockersTab';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import { AddressChip, PlainSummary } from './SummaryCardKit';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;
type DepositsText = NonNullable<NonNullable<Tt['account_summary']>['deposits']>;

/** Each general rule's icon, also used where a transaction changes it. */
export const RULE_ICON: Record<DefaultDepositRule, LucideIcon> = { Accept: CheckCircle2, AllowExisting: Inbox, Reject: Ban };

/** The last column: what applies to each row, centred under the console link. */
const END_COLUMN = 'min-w-0 sm:w-40 sm:shrink-0 px-1 sm:px-2 text-center truncate';
/** The amount columns before it: what the account holds and what waits for it in lockers. */
/** One line per cell: a value too long for its column ends in an ellipsis, whole in its title. */
const AMOUNT_COLUMN = 'min-w-0 sm:w-44 sm:shrink-0 px-1 sm:px-2 text-center truncate';
/** The amount cells themselves: number and unit side by side, centred. */
const AMOUNT_CELL = 'min-w-0 sm:w-44 sm:shrink-0 px-1 sm:px-2 flex flex-col items-center whitespace-nowrap';
/** On a phone the column headers are hidden: each cell carries its own small label. */
const PHONE_LABEL = 'sm:hidden text-[9px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]';

/** What the account holds of a resource and what waits for it in lockers, ready to show. */
interface RowAmounts {
    /** Formatted numbers: an amount, or a count of NFTs. */
    held: string;
    waiting: string;
    /** Counts are of NFTs (the unit reads "NFT"); amounts take the resource's symbol. */
    nft: boolean;
}

/** Units longer than this end in an ellipsis; the cell's title has them whole. */
const UNIT_MAX = 5;
const shortUnit = (unit: string) => (unit.length > UNIT_MAX ? `${unit.slice(0, UNIT_MAX)}…` : unit);

/**
 * One amount cell: the number gives way (ellipsis) when the column is too
 * narrow, the unit never does, so a long amount still says what it counts.
 */
function AmountCell({ label, value, unit, muted }: { label: string; value: string; unit: string; muted?: boolean }) {
    const full = unit ? `${value} ${unit}` : value;
    return (
        <span className={`${AMOUNT_CELL} text-sm font-semibold ${muted ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`} title={full}>
            <span className={PHONE_LABEL}>{label}</span>
            <span className="flex items-center justify-center gap-1 min-w-0 max-w-full">
                <span className="min-w-0 truncate">{value}</span>
                {unit && <span className="shrink-0">{shortUnit(unit)}</span>}
            </span>
        </span>
    );
}

/**
 * An entity's raw Gateway details under the `full` key, the one shared by the
 * explorer's asset rows (the `detail` key may hold the trimmed EntityMeta).
 */
function useFullDetails(address: string, network: Network) {
    return useQuery({
        queryKey: entityKeys.full(address, network),
        queryFn: () => apiFetchEntityDetails(address, network as 'mainnet' | 'stokenet'),
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: 1,
    });
}

const consoleLink = (locale: string, account: string) => `/${locale}/console/account-deposits?account=${account}`;

/** The general rule in plain words, with its icon. */
function RuleLine({ settings, d }: { settings: DepositSettings; d?: DepositsText }) {
    const Icon = RULE_ICON[settings.defaultRule];
    const rule = d?.rules?.[settings.defaultRule];
    return (
        <div className="flex items-center gap-3 min-w-0">
            <span className="size-8 rounded-full shrink-0 grid place-items-center bg-[var(--color-primary)]/10">
                <Icon className="size-4 text-[var(--color-primary)]" />
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-bold text-[var(--color-text-main)]">{rule?.label ?? settings.defaultRule}</span>
                <span className="block text-xs text-[var(--color-text-muted)]">{rule?.hint}</span>
            </span>
        </div>
    );
}

/**
 * One resource of the rules as a list row: its icon and name from its own
 * details (one shared cache entry per resource; a placeholder until they
 * arrive, never the address first and the name after), an NFT id when the
 * badge is one NFT, the address to copy, and what applies to it on the right.
 */
function ResourceRow({
    resource,
    nftId,
    amounts,
    columns,
    aside,
    network,
    locale,
    copiedAddress,
    onCopy,
    copyTitle,
    unnamed,
}: {
    resource: string;
    nftId?: string;
    amounts: RowAmounts;
    /** The column labels, shown in each cell on a phone. */
    columns: [string, string, string];
    aside?: ReactNode;
    network: Network;
    locale: string;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
    copyTitle: string;
    unnamed: string;
}) {
    const { data, isPending } = useFullDetails(resource, network);
    const items = data?.metadata?.items as GatewayMetadataItem[] | undefined;
    // The address already sits below: an unnamed resource says so instead of repeating it.
    const name = getMetadataString(items, 'symbol') || getMetadataString(items, 'name');
    const icon = getMetadataString(items, 'icon_url');
    const unit = amounts.nft ? 'NFT' : getMetadataString(items, 'symbol') || getMetadataString(items, 'name');

    return (
        <li className="flex flex-wrap items-center gap-3 py-3">
            <span className="flex items-center gap-3 min-w-0">
                {isPending ? (
                    <span className="size-8 rounded-full shrink-0 animate-pulse bg-[var(--color-card-border)]" />
                ) : icon ? (
                    <SafeImage src={icon} alt={name} fallbackName={name || resource} zoomable={false} className="size-8 rounded-full object-cover shrink-0" />
                ) : (
                    <span className="size-8 rounded-full shrink-0 grid place-items-center bg-[var(--color-card-border)]">
                        <BadgeCheck className="size-4 text-[var(--color-text-muted)]" />
                    </span>
                )}
                <span className="min-w-0 flex flex-col gap-0.5">
                    {isPending ? (
                        <span className="block h-5 w-24 rounded animate-pulse bg-[var(--color-card-border)]" />
                    ) : (
                        <Link
                            href={dashboardRoutes.entity(locale, resource, { network })}
                            className="text-sm font-bold text-[var(--color-text-main)] hover:text-[var(--color-primary)] truncate"
                        >
                            {name || <span className="italic font-semibold text-[var(--color-text-muted)]">{unnamed}</span>}
                            {nftId && <span className="ml-1.5 font-mono text-xs font-normal text-[var(--color-text-muted)]">{nftId}</span>}
                        </Link>
                    )}
                    <AddressChip address={resource} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                </span>
            </span>
            <span className="grid grid-cols-3 w-full sm:flex sm:w-auto sm:ml-auto items-center">
                <AmountCell label={columns[0]} value={amounts.held} unit={unit} />
                <AmountCell label={columns[1]} value={amounts.waiting} unit={unit} muted={amounts.waiting === '0'} />
                <span className={`${END_COLUMN} flex flex-col items-center sm:block`}>
                    {aside && <span className={PHONE_LABEL}>{columns[2]}</span>}
                    {aside}
                </span>
            </span>
        </li>
    );
}

/** A plain titled list, the way the pool's reserves read; a sentence stands in when empty. */
function List({ title, hint, count, empty, columns, children }: {
    title: string;
    hint?: string;
    count: number;
    empty?: string;
    /** Labels of the amount columns and the last one, shown above the rows. */
    columns: [string, string, string];
    children: ReactNode;
}) {
    const label = 'text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]';
    return (
        <section>
            <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                    <h4 className={label}>
                        {title} ({count})
                    </h4>
                    {hint && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{hint}</p>}
                </div>
                {count > 0 && (
                    <div className={`hidden sm:flex items-center ${label}`}>
                        <span className={AMOUNT_COLUMN}>{columns[0]}</span>
                        <span className={AMOUNT_COLUMN}>{columns[1]}</span>
                        <span className={END_COLUMN}>{columns[2]}</span>
                    </div>
                )}
            </div>
            {count > 0 ? (
                <ul className="divide-y divide-[var(--color-card-border)]">{children}</ul>
            ) : (
                <p className="text-xs text-[var(--color-text-muted)] py-3">{empty}</p>
            )}
        </section>
    );
}

/**
 * The account card's Deposits tab: who else may deposit into the account, as
 * the console's "Account deposits" tool reads and edits it (same reader, same
 * cache). The general rule leads; the token exceptions and the badges that
 * skip the rules follow as plain lists; the console edits them.
 */
export function AccountDepositsTab({
    address,
    network,
    locale,
    copiedAddress,
    onCopy,
    tt,
}: {
    address: string;
    network: Network;
    locale: string;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
    tt?: Tt;
}) {
    const d = tt?.account_summary?.deposits;
    const { data: settings, isLoading, isError } = useDepositSettings(address, network);
    const { data: account } = useFullDetails(address, network);
    const holdings = account ? mapHoldings(account as unknown as Record<string, unknown>) : undefined;
    const { data: lockers } = useAccountLockers(address, network);

    if (isLoading) return <Message>{d?.loading}</Message>;
    if (isError || !settings) return <Message>{d?.error}</Message>;

    const exceptions = Object.entries(settings.preferences) as Array<[string, ResourcePreference]>;
    const amountsOf = (resource: string): RowAmounts => {
        const nft = holdings?.nonFungibles.find((h) => h.resourceAddress === resource);
        const fungible = holdings?.fungibles.find((h) => h.resourceAddress === resource);
        const claims = (lockers ?? []).flatMap((l) => l.waiting).filter((c) => c.resource === resource);
        const nftsWaiting = claims.reduce((n, c) => n + (c.nftIds?.length ?? 0), 0);
        const amountWaiting = Number(sumDecimals(claims.filter((c) => !c.nftIds).map((c) => c.amount ?? '0')));
        const isNft = isNonFungibleResource(resource);
        return {
            held: isNft ? String(nft?.ids.length ?? 0) : formatNumber(Number(fungible?.amount ?? 0), 4, locale),
            waiting: isNft ? String(nftsWaiting) : formatNumber(amountWaiting, 4, locale),
            nft: isNft,
        };
    };
    const columns: [string, string, string] = [d?.held ?? 'Held', d?.in_lockers ?? 'In lockers', ''];
    const row = (resource: string, aside: ReactNode, nftId?: string) => (
        <ResourceRow
            key={`${resource}:${nftId ?? ''}`}
            resource={resource}
            nftId={nftId}
            amounts={amountsOf(resource)}
            columns={[columns[0], columns[1], d?.status ?? 'Status']}
            aside={aside}
            network={network}
            locale={locale}
            copiedAddress={copiedAddress}
            onCopy={onCopy}
            copyTitle={d?.copy ?? 'Copy'}
            unnamed={d?.unnamed ?? 'Unnamed resource'}
        />
    );

    return (
        <div className="space-y-6 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--color-card-border)]">
                <RuleLine settings={settings} d={d} />
                <Link href={consoleLink(locale, address)} className={`${END_COLUMN} text-xs font-bold text-[var(--color-primary)] hover:underline`}>
                    {d?.edit ?? 'Change in the console'}
                </Link>
            </div>

            <List
                title={d?.exceptions ?? 'Token exceptions'}
                hint={d?.exceptions_hint}
                count={exceptions.length}
                empty={d?.no_exceptions}
                columns={[columns[0], columns[1], d?.status ?? 'Status']}
            >
                {exceptions.map(([resource, preference]) =>
                    row(
                        resource,
                        <span
                            className={`text-xs font-bold cursor-help ${preference === 'Allowed' ? 'text-emerald-500' : 'text-red-500'}`}
                            title={preference === 'Allowed' ? d?.allowed_title : d?.refused_title}
                        >
                            {preference === 'Allowed' ? d?.allowed ?? 'Allowed' : d?.refused ?? 'Refused'}
                        </span>,
                    ),
                )}
            </List>

            <List
                title={d?.depositors ?? 'Authorised depositors'}
                hint={d?.depositors_hint}
                count={settings.depositors.length}
                empty={d?.no_depositors}
                columns={columns}
            >
                {settings.depositors.map((badge) => row(badge.resource, null, badge.nftId))}
            </List>

            <p className="text-[11px] text-[var(--color-text-muted)]">{d?.note}</p>
        </div>
    );
}

/**
 * The deposit rules in the account's summary, laid out like its lockers: the
 * general rule, and how many exceptions and badges sit on top of it.
 * Nothing is drawn until they are read.
 */
export function AccountDepositsSummary({ address, network, tt }: { address: string; network: Network; tt?: Tt }) {
    const d = tt?.account_summary?.deposits;
    const { data: settings } = useDepositSettings(address, network);
    if (!settings) return null;
    const values = Object.values(settings.preferences);
    const allowed = values.filter((p) => p === 'Allowed').length;
    const refused = values.length - allowed;

    const tile = (label: string, value: ReactNode) => (
        <div className="flex flex-col bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-3 h-full">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1.5">{label}</span>
            <span className="text-sm font-bold text-[var(--color-text-main)]">{value}</span>
        </div>
    );

    return (
        <div>
            <h4 className="text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider mb-3">{d?.label ?? 'Deposits'}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-3">
                    <RuleLine settings={settings} d={d} />
                </div>
                {tile(
                    d?.exceptions ?? 'Token exceptions',
                    values.length ? `${allowed} ${d?.allowed_short ?? 'allowed'} · ${refused} ${d?.refused_short ?? 'refused'}` : d?.none_short ?? 'None',
                )}
                {tile(d?.depositors ?? 'Authorised depositors', settings.depositors.length || (d?.none_short ?? 'None'))}
            </div>
        </div>
    );
}

function Message({ children }: { children: ReactNode }) {
    return (
        <div className="py-4">
            <PlainSummary>{children}</PlainSummary>
        </div>
    );
}
