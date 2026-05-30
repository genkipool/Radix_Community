'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, FileText, AlertCircle, Zap } from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import { getXrdAddress } from '../constants';
import { DetailRow } from '../../components/DetailRow';
import { getMetaValue } from '../utils/metadataUtils';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { resolveProposerInfo, findProposerValidator } from '../utils/proposerUtils';
import { getWellKnownKey, getGenericTooltipKey } from '../constants/wellKnownAddresses';

import { TransactionDetailsTabProps } from '../types/components.types';
import type { GatewayEvent, GatewayField } from '@/features/dashboard/types/shared.types';

/* ── Asset Name Resolver Component (for async metadata) ── */
function ResourceName({ address, network }: { address: string; network: string }) {
    const meta = useEntityData(address, network);
    if (!address) return null;
    const rawVal = meta?.name || address;
    const displayVal = rawVal.length > 40 ? rawVal.slice(0, 37).trim() + '...' : rawVal;

    return (
        <span className="font-bold italic text-[var(--color-primary)] truncate pe-1" title={meta?.name || address}>
            {displayVal}
        </span>
    );
}

/* ── Reusable row inside an event card ── */
function EventRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row gap-1 border-b border-[var(--color-card-border)] pb-2">
            <span className="text-[var(--color-text-muted)] w-full sm:w-1/3 font-semibold">{label}:</span>
            <span className="text-[var(--color-text-main)] w-full sm:w-2/3">{children}</span>
        </div>
    );
}

/* ── XRD address constants ── */
/** XRD Resource Address is now centralized in constants.ts */

/**
 * TransactionDetailsTab
 *
 * Content of the "Details" tab: metadata rows, event list,
 * raw manifest display and error message (if any).
 *
 * NOTE: This tab renders data that is NOT available in the Summary tab.
 * The Summary tab works with `balance_changes` and `parseManifest` output,
 * while this tab parses raw `receipt.events` — a completely different data path.
 * The metadata rows (state_version, epoch, round, confirm_time) and the manifest
 * instructions display are also exclusive to this tab.
 */
export function TransactionDetailsTab({
    details, tx, tt, te, onCopy, copiedAddress, formatEntity, network, timezone, locale
}: TransactionDetailsTabProps) {
    const [showRawEvents, setShowRawEvents] = React.useState(false);
    const qc = useQueryClient();
    const validatorsData = qc.getQueryData<{ validators: import('@/types/radix').Validator[] }>(['validators', network ?? 'mainnet']);
    const { receipt, manifest_instructions } = details || {};
    const isSuccess = tx.status === 'CommittedSuccess' || tx.status === 'Committed';

    const proposerInfo = resolveProposerInfo(details ?? null);
    const proposerValidator = proposerInfo && validatorsData?.validators
        ? findProposerValidator(proposerInfo, validatorsData.validators)
        : null;



    /* ── Entity name/symbol resolver (uses affected_global_entities from receipt + cache) ── */
    const lookupEntityName = (addr: string): string | null => {
        if (!addr) return null;
        if (addr === getXrdAddress(network)) return 'XRD';

        if (addr.startsWith('validator_')) {
            const validator = validatorsData?.validators?.find((v) => v.address === addr);
            if (validator?.name) return validator.name;
        }

        if (!details?.affected_global_entities) return null;
        const match = (details.affected_global_entities ?? []).find((e) =>
            typeof e === 'string' ? e === addr : e.address === addr
        );
        if (!match || typeof match === 'string' || !match.metadata?.items) return null;

        const items = match.metadata.items ?? [];
        return getMetaValue(items, 'symbol') || getMetaValue(items, 'name') || null;
    };

    /* ── Inline rendering helpers ── */
    const fResource = (addr: string) => {
        if (!addr || addr.startsWith('internal_')) return null;
        let resolvedName = lookupEntityName(addr);
        if (!resolvedName) {
            const formatted = formatEntity(addr);
            if (formatted !== addr && !formatted.includes('...')) {
                resolvedName = formatted;
            }
        }

        const well_known = tt?.well_known_tooltips as Record<string, string> | undefined;
        const type_tooltips = tt?.type_tooltips as Record<string, string> | undefined;

        const wellKnownKey = getWellKnownKey(addr, network || 'mainnet');
        const genericKey = getGenericTooltipKey(addr);
        const wellKnownTip = wellKnownKey && well_known?.[wellKnownKey]
            ? well_known[wellKnownKey]
            : genericKey && type_tooltips?.[genericKey]
                ? type_tooltips[genericKey]
                : null;

        return (
            <span className="inline-flex items-center gap-1.5 align-middle">
                {resolvedName && (
                    <span className="font-bold text-[var(--color-text-main)]">
                        {resolvedName}
                    </span>
                )}
                <button type="button"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer transition-colors font-mono text-[11px] font-normal text-left"
                    title={wellKnownTip || addr}
                    onClick={(e) => {
                        e.stopPropagation();
                        onCopy(addr);
                    }}
                >
                    {addr.length > 25 ? `${addr.slice(0, 12)}...${addr.slice(-12)}` : addr}
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onCopy(addr);
                    }}
                    className={`shrink-0 p-0.5 rounded transition-colors ${copiedAddress === addr ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                    title="Copy"
                >
                    {copiedAddress === addr ? <Check className="size-3" /> : <Copy className="size-3" />}
                </button>
            </span>
        );
    };

    const fAmount = (amt: string, addr: string) => {
        if (!amt) return null;
        if (amt.includes('NFT')) {
            return (
                <span className="font-bold text-[var(--color-text-main)] inline-flex items-center gap-1.5">
                    {amt} {addr && !addr.startsWith('internal_') ? fResource(addr) : ''}
                </span>
            );
        }
        const parsed = parseFloat(amt);
        const truncated = Math.trunc(Math.abs(parsed) * 10000) / 10000;
        const displayAmt = isNaN(parsed) ? amt : truncated.toLocaleString(locale, { maximumFractionDigits: 4 });
        return (
            <span className="font-bold text-[var(--color-text-main)] inline-flex items-center gap-1.5 flex-wrap">
                {displayAmt} {addr && !addr.startsWith('internal_') ? fResource(addr) : ''}
            </span>
        );
    };

    const fAmountSimple = (amt: string, addr: string) => {
        if (!amt) return null;
        const parsed = parseFloat(amt);
        const truncated = Math.trunc(Math.abs(parsed) * 10000) / 10000;
        const displayAmt = isNaN(parsed) ? amt : truncated.toLocaleString(locale, { maximumFractionDigits: 4 });
        return (
            <span className="font-bold text-[var(--color-text-main)] inline-flex items-center gap-1.5">
                {displayAmt} <ResourceName address={addr} network={network || 'mainnet'} />
            </span>
        );
    };

    const fAddress = (addr: string) => {
        if (!addr) return null;
        let resolvedName = lookupEntityName(addr);
        if (!resolvedName) {
            const formatted = formatEntity(addr);
            if (formatted !== addr && !formatted.includes('...')) {
                resolvedName = formatted;
            }
        }

        const well_known = tt?.well_known_tooltips as Record<string, string> | undefined;
        const type_tooltips = tt?.type_tooltips as Record<string, string> | undefined;

        const wellKnownKey = getWellKnownKey(addr, network || 'mainnet');
        const genericKey = getGenericTooltipKey(addr);
        const wellKnownTip = wellKnownKey && well_known?.[wellKnownKey]
            ? well_known[wellKnownKey]
            : genericKey && type_tooltips?.[genericKey]
                ? type_tooltips[genericKey]
                : null;

        return (
            <span className="inline-flex items-start sm:items-center gap-1.5 sm:gap-2 flex-col sm:flex-row w-full mt-1 sm:mt-0">
                {resolvedName && (
                    <span className="font-bold text-[var(--color-text-main)] shrink-0">
                        {resolvedName}
                    </span>
                )}
                <span className="inline-flex items-center gap-2 max-w-full">
                    <button type="button"
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer transition-colors font-mono text-[11px] break-all text-left"
                        title={wellKnownTip || addr}
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopy(addr);
                        }}
                    >
                        {addr}
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCopy(addr);
                        }}
                        className={`shrink-0 p-1 rounded-md transition-colors ${copiedAddress === addr ? 'text-green-500 bg-green-500/10' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)]'}`}
                        title="Copy"
                    >
                        {copiedAddress === addr ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                </span>
            </span>
        );
    };

    /* ── Extract amount + resource from an event payload ── */
    const extractEventData = (ev: GatewayEvent) => {
        const data = ev.data;
        const fields = data?.fields || [];
        const isEnum = data?.kind === 'Enum';
        const emitter = ev.emitter?.entity || {} as { entity_address: string; entity_type: string };
        const emitterAddr = emitter.entity_address || '';
        const emitterType = emitter.entity_type || '';

        let amount = '';
        let resource = '';

        if (isEnum) {
            resource = sanitizeText(String(fields[0]?.value || ''));
            if (ev.data?.variant_name === 'Fungible') {
                amount = sanitizeText(String(fields[1]?.value || ''));
            } else if (ev.data?.variant_name === 'NonFungible') {
                const count = fields[1]?.elements?.length || 0;
                amount = `${count} ${tt?.nfts ?? 'NFT(s)'}`;
            }
        } else {
            // Named amount fields — includes claimed_xrd for ClaimXrdEvent
            const amtField = fields.find((f: GatewayField) =>
                f.field_name === 'amount' ||
                f.field_name === 'claimed_xrd' ||
                f.field_name === 'amount_change_x' ||
                f.field_name === 'amount_after_x',
            );

            // NFT id arrays — the API uses both "ids" and "local_ids"
            const idsField = fields.find((f: GatewayField) =>
                f.field_name === 'ids' || f.field_name === 'local_ids',
            );

            const resField = fields.find((f: GatewayField) =>
                f.field_name === 'resource_address' ||
                f.field_name === 'resource' ||
                f.field_name === 'token_address' ||
                f.field_name === 'input_address' ||
                f.field_name === 'input_resource',
            );

            amount = amtField ? sanitizeText(String(amtField.value || '')) : '';

            // Fallback: if no named amount found, try any field with kind "Decimal"
            if (!amount) {
                const decimalField = fields.find((f: GatewayField) => f.kind === 'Decimal');
                if (decimalField) {
                    amount = sanitizeText(String(decimalField.value || ''));
                }
            }

            // NFT count from ids array
            if (!amount && idsField) {
                const count = idsField.elements?.length || 0;
                amount = `${count} ${tt?.nfts ?? 'NFT(s)'}`;
            }

            resource = resField ? sanitizeText(String(resField.value || '')) : '';

            // Fallback for resource address in fields (essential for VaultCreation etc)
            if (!resource) {
                const anyResValue = fields.find((f: GatewayField) =>
                    typeof f.value === 'string' && f.value.startsWith('resource_')
                );
                if (anyResValue) {
                    resource = sanitizeText(String(anyResValue.value));
                }
            }
        }

        // For Burn/Mint events from a GlobalResource emitter, use the emitter as the resource
        if (!resource && (emitterType.includes('Resource') || emitterType.includes('FungibleResource') || emitterType.includes('NonFungibleResource'))) {
            resource = sanitizeText(emitterAddr);
        }

        return { amount, resource, fields, isEnum };
    };

    /* ── Build a standard "amount + location" event description ── */
    const renderAmountAndLocation = (titleText: string, amount: string, resource: string, locationLabel: string, emitter: string) => (
        <div className="flex flex-col gap-2">
            <EventRow label={titleText}>{fAmount(amount, resource)}</EventRow>
            <EventRow label={locationLabel}>{fAddress(emitter)}</EventRow>
        </div>
    );

    /* ── Build a "location only" event description ── */
    const renderLocationOnly = (locationLabel: string, emitter: string) => (
        <div className="flex flex-col gap-2">
            <EventRow label={locationLabel}>{fAddress(emitter)}</EventRow>
        </div>
    );

    /* ── Classify an event and produce { titleText, description } ── */
    const classifyEvent = (ev: GatewayEvent) => {
        const name = String(ev.name || '');
        const emitter = sanitizeText(String(ev.emitter?.entity?.entity_address || ''));
        const { amount, resource, fields, isEnum } = extractEventData(ev);

        const getField = (key: string, idx: number) => {
            if (isEnum) return sanitizeText(String(fields[idx]?.value || ''));
            const field = fields.find((f: GatewayField) => f.field_name === key);
            return sanitizeText(String(field?.value || field?.hex || ''));
        };

        const tStr = (val: unknown, fallback: string) => String(val || fallback);

        // LockFee (Specific)
        if (name === 'LockFeeEvent') {
            const titleText = tStr(te?.lock_fee, 'Locked Max Fee');
            const tooltip = tStr(te?.lock_fee_title, 'Maximum fee the user is willing to pay in this transaction');
            return {
                titleText,
                tooltip,
                description: renderAmountAndLocation(titleText, amount, resource || getXrdAddress(network), tStr(te?.at, 'at'), emitter)
            };
        }

        // Withdraw / Deposit
        if (name === 'WithdrawEvent' || name === 'DepositEvent') {
            const titleText = name === 'WithdrawEvent' ? tStr(te?.withdraw, 'Withdrawal') : tStr(te?.deposit, 'Deposit');
            const dirLabel = name === 'WithdrawEvent' ? tStr(te?.from, 'from') : tStr(te?.to, 'to');
            return { titleText, description: renderAmountAndLocation(titleText, amount, resource, dirLabel, emitter) };
        }

        // Fee events
        if (name.includes('Fee')) {
            const feeResource = resource || getXrdAddress(network);
            const titleText = tStr(te?.fee, 'Fee Payment');
            return { titleText, description: renderAmountAndLocation(titleText, amount, feeResource, tStr(te?.at, 'at'), emitter) };
        }

        // Swap
        if (name === 'SwapEvent' || name.includes('Swap')) {
            const dx = getField('amount_change_x', 0) || getField('amount', 1);
            const dy = getField('amount_change_y', 1) || getField('new_balance', 2);
            return {
                titleText: tStr(te?.swap, 'Swap'),
                description: (
                    <div className="flex flex-col gap-2">
                        <EventRow label={tStr(te?.at, 'at')}>{fAddress(emitter)}</EventRow>
                        <EventRow label={tStr(te?.change, 'Change')}><b>Δx: {dx}</b> / <b>Δy: {dy}</b></EventRow>
                    </div>
                ),
            };
        }

        // Burn
        if (name.includes('Burn')) {
            const titleText = tStr(te?.burn, 'Burn');
            return { titleText, description: renderAmountAndLocation(titleText, amount, resource || emitter, tStr(te?.at, 'at'), emitter) };
        }

        // Mint
        if (name.includes('Mint')) {
            const titleText = tStr(te?.mint, 'Mint');
            return {
                titleText,
                description: (
                    <div className="flex flex-col gap-2">
                        <EventRow label={titleText}>{fAmountSimple(amount, resource || emitter)}</EventRow>
                        <EventRow label={tStr(te?.at, 'at')}>{fAddress(emitter)}</EventRow>
                    </div>
                )
            };
        }

        // Valuation
        if (name.includes('Valuation')) {
            const titleText = tStr(te?.valuation, 'Valuation');
            return { titleText, description: renderLocationOnly(tStr(te?.at, 'at'), emitter) };
        }

        // Auth
        if (name.includes('Auth')) {
            const titleText = tStr(te?.auth, 'Authorization');
            return { titleText, description: renderLocationOnly(tStr(te?.at, 'at'), emitter) };
        }

        // Unstake (must come before Stake check)
        if (name.includes('Unstake')) {
            const titleText = tStr(te?.unstake, 'Unstake');
            return { titleText, description: renderAmountAndLocation(titleText, amount, resource || emitter, tStr(te?.from, 'from'), emitter) };
        }

        // Stake
        if (name.includes('Stake')) {
            const titleText = tStr(te?.stake, 'Stake');
            return { titleText, description: renderAmountAndLocation(titleText, amount, resource || emitter, tStr(te?.to, 'to'), emitter) };
        }

        // Claim
        if (name.includes('Claim')) {
            const titleText = tStr(te?.claim, 'Claim');
            return { titleText, description: renderAmountAndLocation(titleText, amount, resource || emitter, tStr(te?.from, 'from'), emitter) };
        }

        // BetCreatedEvent & BetVoteEvent
        if (name === 'BetVoteEvent' || name === 'BetCreatedEvent') {
            const isBetCreated = name === 'BetCreatedEvent';
            const betOption = getField(isBetCreated ? 'name' : 'option', 1);
            return {
                titleText: isBetCreated ? tStr(te?.bet_name, 'Bet Name') : tStr(te?.bet_vote, 'Vote / Prediction'),
                tooltip: isBetCreated ? undefined : tStr(te?.bet_vote_title, 'Represents the allocation of tokens towards an option or vote in a component.'),
                description: (
                    <div className="flex flex-col gap-2">
                        <EventRow label={tStr(te?.at, 'at')}>{fAddress(emitter)}</EventRow>
                        <EventRow label={isBetCreated ? tStr(te?.name, 'Name') : tStr(te?.option, 'Option')}>
                            <span className="font-bold text-pink-500">
                                {fResource(betOption)}
                            </span>
                        </EventRow>
                        {resource && !isBetCreated && (
                            <EventRow label={tStr(te?.name, 'Name')}>
                                <ResourceName address={resource} network={network || 'mainnet'} />
                            </EventRow>
                        )}
                        {amount && <EventRow label={tStr(te?.amount, 'Amount')}>{fAmount(amount, resource)}</EventRow>}
                    </div>
                )
            };
        }

        // SetMetadataEvent
        if (name === 'SetMetadataEvent') {
            const key = getField('key', 0);
            const valueField = fields.find((f: GatewayField) => f.field_name === 'value');
            let metaValue = '...';

            const vfFields = valueField?.fields as GatewayField[] | undefined;
            if (valueField && valueField.variant_name && Array.isArray(vfFields) && vfFields.length > 0) {
                metaValue = sanitizeText(String(vfFields[0].value || vfFields[0].hex || ''));
            }

            return {
                titleText: tStr(te?.set_metadata, 'Profile/Config Update'),
                tooltip: tStr(te?.set_metadata_title, 'Setup or modification of descriptive information (e.g. name, icon) for the component or resource.'),
                description: (
                    <div className="flex flex-col gap-2">
                        <EventRow label={tStr(te?.at, 'at')}>{fAddress(emitter)}</EventRow>
                        <EventRow label={key}>
                            <span className="font-mono text-xs break-all text-[var(--color-text-main)] max-w-full">
                                {metaValue.length > 100 ? metaValue.slice(0, 100) + '...' : metaValue}
                            </span>
                        </EventRow>
                    </div>
                )
            };
        }

        // VaultCreationEvent
        if (name === 'VaultCreationEvent') {
            const vaultId = getField('vault_id', 0);

            const well_known = tt?.well_known_tooltips as Record<string, string> | undefined;
            const type_tooltips = tt?.type_tooltips as Record<string, string> | undefined;

            const wellKnownKey = resource ? getWellKnownKey(resource, network || 'mainnet') : null;
            const genericKey = resource ? getGenericTooltipKey(resource) : null;
            const wellKnownTip = wellKnownKey && well_known?.[wellKnownKey]
                ? well_known[wellKnownKey]
                : genericKey && type_tooltips?.[genericKey]
                    ? type_tooltips[genericKey]
                    : null;

            return {
                titleText: tStr(te?.vault_creation, 'Vault Creation'),
                tooltip: tStr(te?.vault_creation_title, 'An internal vault has been created to securely store physical assets.'),
                description: (
                    <div className="flex flex-col gap-2">
                        {resource && (
                            <>
                                <EventRow label={tStr(te?.name, 'Name')}>
                                    <ResourceName address={resource} network={network || 'mainnet'} />
                                </EventRow>
                                <EventRow label={tStr(te?.resource, 'Resource')}>
                                    <span className="inline-flex items-center gap-1.5 align-middle">
                                        <button type="button"
                                            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] cursor-pointer transition-colors font-mono text-[11px] font-normal text-left"
                                            title={wellKnownTip || resource}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCopy(resource);
                                            }}
                                        >
                                            {resource.length > 25 ? `${resource.slice(0, 12)}...${resource.slice(-12)}` : resource}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCopy(resource);
                                            }}
                                            className={`shrink-0 p-0.5 rounded transition-colors ${copiedAddress === resource ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                            title="Copy"
                                        >
                                            {copiedAddress === resource ? <Check className="size-3" /> : <Copy className="size-3" />}
                                        </button>
                                    </span>
                                </EventRow>
                            </>
                        )}
                        <EventRow label={tStr(te?.at, 'at')}>{fAddress(emitter)}</EventRow>
                        <EventRow label={tStr(te?.vault_id, 'Vault ID')}>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[var(--color-text-main)] break-all">
                                    {vaultId || '-'}
                                </span>
                                {vaultId && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onCopy(vaultId); }}
                                        className="p-1 hover:bg-[var(--color-surface-hover)] rounded transition-colors shrink-0"
                                        title={tt?.copy_raw || 'Copy'}
                                    >
                                        {copiedAddress === vaultId ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5 text-[var(--color-text-muted)]" />}
                                    </button>
                                )}
                            </div>
                        </EventRow>
                    </div>
                )
            };
        }

        // RatesChangedEvent
        if (name === 'RatesChangedEvent') {
            const rateType = getField('rate_type', 0);
            const prev = getField('previous', 1);
            const curr = getField('current', 2);
            return {
                titleText: tStr(te?.rates_changed, 'Rates Update'),
                tooltip: tStr(te?.rates_changed_title, 'The protocol has updated interest rates as a result of the current market state?.'),
                description: (
                    <div className="flex flex-col gap-2">
                        <EventRow label={tStr(te?.at, 'at')}>{fAddress(emitter)}</EventRow>
                        <EventRow label={tStr(te?.rate_type, 'Rate Type')}>
                            <span className="font-bold text-[var(--color-primary)]">{rateType}</span>
                        </EventRow>
                        <EventRow label={tStr(te?.change, 'Change')}>
                            <span className="inline-flex items-center gap-2 font-bold text-teal-400">
                                <span>{prev}%</span>
                                <span>➔</span>
                                <span>{curr}%</span>
                            </span>
                        </EventRow>
                    </div>
                )
            };
        }

        // Generic fallback
        const genericFields = fields
            .filter((f: GatewayField) => f.value && f.field_name)
            .slice(0, 4)
            .map((f: GatewayField) => `${f.field_name}: ${f.value}`).join(', ');

        return {
            titleText: tStr(tt?.unknown, 'Event'),
            description: (
                <div className="flex flex-col gap-2">
                    <EventRow label={tStr(te?.at, 'at')}>{fAddress(emitter)}</EventRow>
                    {genericFields && (
                        <EventRow label={tStr(tt?.details, 'Details')}>
                            <span className="break-all">{genericFields}{fields.length > 4 ? '...' : ''}</span>
                        </EventRow>
                    )}
                </div>
            ),
        };
    };

    return (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-card-border)] p-4 sm:p-6 shadow-inner">

            {/* ── Metadata rows ── */}
            <DetailRow label={tt?.transaction_id || 'Transaction ID'} value={sanitizeText((details.intent_hash ?? tx.intentHash) as string)} copyable={(details.intent_hash ?? tx.intentHash) as string} onCopy={onCopy} copiedAddress={copiedAddress} />

            <DetailRow label={tt?.status || 'Status'} value={
                <span className={`text-xs font-bold uppercase tracking-wider ${isSuccess ? 'text-[var(--color-accent)]' : 'text-red-500'}`}>
                    {isSuccess ? (tt?.success || 'Success') : (tt?.failed || 'Failed')}
                </span>
            } />

            <DetailRow
                label={tt?.confirm_time || 'Confirm time'}
                value={(
                    <>
                        {new Date(details?.confirmed_at || tx.confirmedAt).toLocaleString(locale, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        <span className="text-[10px] opacity-80"> ({new Date(details?.confirmed_at || tx.confirmedAt).toLocaleString(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC)</span>
                    </>
                )}
            />

            <DetailRow label={tt?.epoch_round || 'Epoch & Round'} value={`${details?.epoch} / ${details?.round}`} />

            <DetailRow
                label={tt?.proposer_state_version_index || 'State Version / Index'}
                value={`${details?.state_version} / #${proposerInfo?.validatorIndex ?? '?'}`}
            />

            {proposerValidator && (
                <DetailRow
                    label={<span title={tt?.proposer_tooltip} className="cursor-help">{tt?.proposer || 'Proposer'}</span>}
                    value={(
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-[var(--color-text-main)] text-sm">
                                {proposerValidator.name}
                            </span>
                            <span className="text-[var(--color-text-muted)] text-[10px] font-mono">
                                {proposerValidator.address.length > 20 ? `${proposerValidator.address.slice(0, 12)}...${proposerValidator.address.slice(-6)}` : proposerValidator.address}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(proposerValidator.address); }}
                                className="p-1 hover:bg-[var(--color-surface)] rounded text-[var(--color-text-muted)] transition-colors shrink-0"
                                title={tt?.copy_raw || 'Copy'}
                            >
                                {copiedAddress === proposerValidator.address ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
                            </button>
                        </div>
                    )}
                />
            )}

            <DetailRow label={tt?.fee || 'Fee Paid'} value={`${sanitizeText(String(tx.feePaid))} XRD`} />
            {tx.message && <DetailRow label={tt?.message_payload as string || 'Message'} value={`"${sanitizeText(String(tx.message))}"`} />}

            {/* ── Events ── */}
            {receipt?.events && receipt.events.length > 0 && (
                <div className="mt-8 mb-6">
                    <h3 className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-4 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                            <Zap className="size-4 text-[var(--color-primary)]" />
                            {tt?.events_label || 'Events'} ({receipt.events.length})
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowRawEvents(!showRawEvents)}
                                className="text-[10px] sm:text-xs text-[var(--color-text-main)] hover:text-[var(--color-text-muted)] transition-colors font-semibold"
                            >
                                {showRawEvents ? String(te?.hide_json_btn || 'Hide Raw JSON') : String(te?.raw_json_btn || 'Show Raw Events JSON')}
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCopy(JSON.stringify(receipt.events, null, 2));
                                }}
                                className={`p-1 rounded-md transition-colors ${copiedAddress === JSON.stringify(receipt.events, null, 2) ? 'text-green-500 bg-green-500/10' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)]'}`}
                                title={tt?.copy_raw || 'Copy Raw JSON'}
                            >
                                {copiedAddress === JSON.stringify(receipt.events, null, 2) ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            </button>
                        </div>
                    </h3>

                    {showRawEvents && (
                        <div className="mb-6">
                            <div className="p-4 sm:p-5 bg-[#0d1117] rounded-xl border border-[var(--color-card-border)] text-xs sm:text-sm font-mono text-green-400/90 break-words custom-scrollbar overflow-x-auto whitespace-pre max-h-[500px] overflow-y-auto shadow-inner leading-relaxed">
                                {JSON.stringify(receipt.events, null, 2)}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {receipt.events.map((ev) => {
                            const { titleText, description, tooltip } = classifyEvent(ev);
                            return (
                                <div key={'event-' + JSON.stringify(ev).slice(0, 50)} className="p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-card-border)] shadow-sm">
                                    <div
                                        title={tooltip as string}
                                        className={`font-bold text-sm text-[var(--color-primary)] mb-3 bg-[var(--color-primary)]/10 inline-block px-2 py-1 rounded ${tooltip ? 'cursor-help' : ''}`}
                                    >
                                        {titleText}
                                    </div>
                                    <div className="text-sm">
                                        {description}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Manifest ── */}
            <div className="mt-8">
                <h3 className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-4 flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5">
                        <FileText className="size-4 text-[var(--color-primary)]" /> {tt?.manifest_label || 'Manifest'}
                    </span>
                    <button type="button" onClick={e => { e.stopPropagation(); onCopy(manifest_instructions || ''); }} className={`p-1.5 rounded-md transition-colors ${copiedAddress === (manifest_instructions || '') ? 'text-green-500 bg-green-500/10' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)]'}`} title={tt?.copy_manifest || 'Copy Manifest'}>
                        {copiedAddress === (manifest_instructions || '') ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    </button>
                </h3>
                <div className="p-4 sm:p-5 bg-[var(--color-bg)] rounded-xl border border-[var(--color-card-border)] text-xs sm:text-sm font-mono text-[var(--color-text-main)] break-words custom-scrollbar overflow-x-auto whitespace-pre max-h-[500px] overflow-y-auto shadow-inner leading-relaxed">
                    {sanitizeText(manifest_instructions as string) || (receipt?.state_updates ? JSON.stringify(receipt.state_updates, null, 2) : (tt?.no_instructions || 'No instructions found.'))}
                </div>
            </div>

            {/* ── Error ── */}
            {receipt?.error_message && (
                <div className="mt-8">
                    <h3 className="text-[11px] text-red-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                        <AlertCircle className="size-4" /> {tt?.error_label || 'Error'}
                    </h3>
                    <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20 text-xs sm:text-sm font-mono text-red-400 break-words shadow-inner">
                        {sanitizeText(receipt.error_message)}
                    </div>
                </div>
            )}
        </div>
    );
}
