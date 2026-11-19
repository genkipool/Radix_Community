import { apiFetchTransactions } from '@/features/dashboard/services/apiClient';
import { olympiaApi } from '@/features/dashboard/services/olympiaApi';
import { getXrdAddress } from '@/features/dashboard/explorador/constants';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import type { FungibleChange, NonFungibleChange } from '@/features/dashboard/types/shared.types';
import type { OlympiaTxItem } from '@/types/olympia';
import type { TransactionInfo } from '@/types/radix';
import type { NetworkScope } from '../olympia/OlympiaParts';
import { actionLabel, type OlympiaDict } from '../olympia/dict';
import { rowsToCsv } from './coinTrackingCsv';
import { resolveTransactionType } from './transactionUtils';

const CSV_HEADER = [
    'Network',
    'Date (UTC)',
    'Transaction Hash',
    'Type',
    'Withdrawals',
    'Deposits',
    'Fee (XRD)',
    'Status',
];

const MAX_EXPORT_PAGES = 100;
const BABYLON_PAGE_LIMIT = 50;
const OLYMPIA_PAGE_LIMIT = 100;
const BABYLON_LAUNCH_DAY = '2023-09-28';

function formatAssetLabel(resourceAddress: string, xrdAddress: string): string {
    return resourceAddress === xrdAddress ? 'XRD' : resourceAddress;
}

function toLocalDay(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildBabylonCsvRow(
    tx: TransactionInfo,
    accountAddress: string,
    xrdAddress: string,
    tt?: Partial<TranslationsT['dashboard']['transactions']>,
): string[] {
    const fungibles = ((tx.balanceChanges?.fungible_balance_changes as FungibleChange[]) || []).filter(
        (c) => c.entity_address === accountAddress && !c.is_fee,
    );
    const nonFungibles = ((tx.balanceChanges?.non_fungible_balance_changes as NonFungibleChange[]) || []).filter(
        (c) => c.entity_address === accountAddress,
    );

    const withdrawals: string[] = [];
    const deposits: string[] = [];

    for (const f of fungibles) {
        const num = Number(f.balance_change);
        const asset = formatAssetLabel(f.resource_address, xrdAddress);
        if (num < 0) {
            withdrawals.push(`${Math.abs(num)} ${asset}`);
        } else if (num > 0) {
            deposits.push(`${num} ${asset}`);
        }
    }

    for (const nf of nonFungibles) {
        if (nf.removed && nf.removed.length > 0) {
            withdrawals.push(`${nf.removed.length} NFT (${nf.resource_address})`);
        }
        if (nf.added && nf.added.length > 0) {
            deposits.push(`${nf.added.length} NFT (${nf.resource_address})`);
        }
    }

    const feeChanges = (tx.balanceChanges?.fungible_fee_balance_changes as FungibleChange[]) || [];
    const accountFee = feeChanges.find((c) => c.entity_address === accountAddress);
    const feePaid = accountFee ? Math.abs(Number(accountFee.balance_change)) : 0;

    const dateUtc = tx.confirmedAt ? new Date(tx.confirmedAt).toISOString() : '';
    const typeStr = resolveTransactionType(tx.manifestClasses || [], [], tt);

    return [
        'Babylon',
        dateUtc,
        tx.intentHash,
        typeStr,
        withdrawals.join(' | '),
        deposits.join(' | '),
        feePaid > 0 ? feePaid.toFixed(8) : '0',
        tx.status || '',
    ];
}

function buildOlympiaCsvRow(tx: OlympiaTxItem, o: OlympiaDict): string[] {
    const withdrawals: string[] = [];
    const deposits: string[] = [];

    for (const c of tx.balanceChanges) {
        const asset = c.symbol || c.rri;
        const abs = c.delta.startsWith('-') ? c.delta.slice(1) : c.delta;
        if (c.deltaNum < 0) {
            withdrawals.push(`${abs} ${asset}`);
        } else if (c.deltaNum > 0) {
            deposits.push(`${abs} ${asset}`);
        }
    }

    const types = [...new Set(tx.actions.map((a) => a.type).filter((t) => t && t !== 'BURN_XRD'))];
    const typeStr =
        types.length === 0
            ? tx.actions.length
                ? actionLabel(o, 'BURN_XRD')
                : actionLabel(o, 'OTHER')
            : types.map((t) => actionLabel(o, t)).join(' · ');

    const dateUtc = tx.timestamp ? new Date(tx.timestamp).toISOString() : '';
    const feePaid = tx.isFeePayer && tx.feeXrd > 0 ? tx.feeXrd.toFixed(8) : '0';

    return [
        'Olympia',
        dateUtc,
        tx.transactionId,
        typeStr,
        withdrawals.join(' | '),
        deposits.join(' | '),
        feePaid,
        'CommittedSuccess',
    ];
}

function triggerCsvDownload(csvText: string, fileName: string) {
    // Prefix UTF-8 BOM so Excel opens accented characters cleanly
    const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export interface ExportAccountTransactionsOptions {
    accountAddress: string;
    olympiaAddress?: string | null;
    scope: NetworkScope;
    network: Network;
    start?: string;
    end?: string;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    olympiaT: OlympiaDict;
    onProgress?: (loadedCount: number) => void;
}

/**
 * Smart CSV exporter for an account's transactions:
 * - `scope === 'all'`: exports Babylon + Olympia (full history or `[start, end]`)
 * - `scope === 'babylon'`: exports Babylon only
 * - `scope === 'olympia'`: exports Olympia only
 */
export async function exportAccountTransactionsCsv({
    accountAddress,
    olympiaAddress,
    scope,
    network,
    start,
    end,
    tt,
    olympiaT,
    onProgress,
}: ExportAccountTransactionsOptions): Promise<number> {
    const effectiveEnd = end ?? start;
    const includeBabylon = scope === 'all' || scope === 'babylon';
    const includeOlympia = Boolean(olympiaAddress) && (scope === 'all' || scope === 'olympia');

    const rows: string[][] = [];
    const xrdAddress = getXrdAddress(network);

    // 1. Babylon transactions (skip when date filter ends strictly before Babylon launch)
    const babylonCanMatch = !effectiveEnd || effectiveEnd >= BABYLON_LAUNCH_DAY;
    if (includeBabylon && babylonCanMatch) {
        const seen = new Set<string>();
        let cursor: string | undefined;

        for (let page = 0; page < MAX_EXPORT_PAGES; page++) {
            const res = await apiFetchTransactions({
                cursor,
                limit: BABYLON_PAGE_LIMIT,
                address: accountAddress,
                network,
                start,
                end: effectiveEnd,
            });

            for (const tx of res.transactions ?? []) {
                if (!seen.has(tx.intentHash)) {
                    seen.add(tx.intentHash);
                    rows.push(buildBabylonCsvRow(tx, accountAddress, xrdAddress, tt));
                }
            }
            onProgress?.(rows.length);

            if (!res.nextCursor) break;
            cursor = res.nextCursor;
        }
    }

    // 2. Olympia transactions (skip when date filter starts strictly after Olympia ended)
    const olympiaCanMatch = !start || start <= BABYLON_LAUNCH_DAY;
    if (includeOlympia && olympiaAddress && olympiaCanMatch) {
        const seen = new Set<string>();
        let cursor: string | undefined;

        for (let page = 0; page < MAX_EXPORT_PAGES; page++) {
            const res = await olympiaApi.transactions(olympiaAddress, cursor, OLYMPIA_PAGE_LIMIT);
            if (!res || res.items.length === 0) break;

            let passedStart = false;
            for (const tx of res.items) {
                if (seen.has(tx.transactionId)) continue;
                seen.add(tx.transactionId);

                const localDay = toLocalDay(tx.timestamp);
                if (start && localDay && localDay < start) {
                    // Items are newest-first, so once older than `start` we can stop paging
                    passedStart = true;
                    break;
                }
                if (effectiveEnd && localDay && localDay > effectiveEnd) {
                    continue;
                }

                rows.push(buildOlympiaCsvRow(tx, olympiaT));
            }
            onProgress?.(rows.length);

            if (passedStart || !res.nextCursor) break;
            cursor = res.nextCursor;
        }
    }

    if (rows.length === 0) {
        return 0;
    }

    const csv = rowsToCsv(rows, CSV_HEADER);
    const shortAddr = `${accountAddress.slice(0, 12)}_${accountAddress.slice(-6)}`;
    const scopeSuffix = olympiaAddress ? scope : 'babylon';
    const rangeSuffix = start ? `${start}_to_${effectiveEnd ?? start}` : 'all';
    triggerCsvDownload(csv, `radix-transactions-${shortAddr}-${network}-${scopeSuffix}-${rangeSuffix}.csv`);

    return rows.length;
}
