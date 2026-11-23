'use client';

import { useState } from 'react';
import Big from 'big.js';
import { Plus, X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useCollectionNfts } from '../../hooks/useCollectionNfts';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isNonFungibleResource } from '../../lib/bulk-send';
import type { AccountHoldings } from '../../types/console.types';
import { AddressField, TextField } from '../shared/fields';
import { ResourceCard } from '../shared/ResourceCard';
import { useConsoleDictionary } from '../../hooks/useConsoleDictionary';

interface Row {
  id: number;
  account: string;
  resource: string;
  value: string;
}

let nextRowId = 0;
const emptyRow = (): Row => ({ id: nextRowId++, account: '', resource: '', value: '' });

/** The CSV the bulk-send parser reads, split into editable rows (header and comments left out, as the parser does, so row numbers match its messages). */
function toRows(csv: string): Row[] {
  const rows = csv
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line, index }) => line && !line.startsWith('//') && !(line.startsWith('#') && !line.includes(',')) && !(index === 0 && !line.split(/[,;\t]/)[0].includes('_')))
    .map(({ line }) => {
      const cells = line.split(/[,;\t]/).map((c) => c.trim());
      const [account = '', resource = '', value = ''] = cells.length >= 3 ? cells : [cells[0], '', cells[1] ?? ''];
      return { id: nextRowId++, account, resource, value };
    });
  return rows.length ? rows : [emptyRow()];
}

/** Rows back to CSV: `account,resource,value`, or `account,value` when the default resource applies. */
const toCsv = (rows: Row[]) =>
  rows
    .filter((r) => r.account.trim() || r.resource.trim() || r.value.trim())
    .map((r) => (r.resource.trim() ? `${r.account.trim()},${r.resource.trim()},${r.value.trim()}` : `${r.account.trim()},${r.value.trim()}`))
    .join('\n');

/** Above this many rows only the first ones are drawn until asked: a holder split can be thousands. */
const VISIBLE_ROWS = 50;


interface RecipientRowsProps {
  csv: string;
  onCsvChange: (csv: string) => void;
  /** The resource a row without one sends, shown in its amount field. */
  defaultResource?: string;
  holdings?: AccountHoldings;
  disabled?: boolean;
}

function NftRowCards({
  resourceAddress,
  selectedId,
  onSelect,
  localIds,
  collectionName,
  collectionIcon,
  loadingLabel,
  disabled,
}: {
  resourceAddress: string;
  selectedId: string;
  onSelect: (id: string) => void;
  localIds: string[];
  collectionName: string;
  collectionIcon?: string;
  loadingLabel: string;
  disabled?: boolean;
}) {
  const network: 'mainnet' | 'stokenet' = resourceAddress.includes('_tdx_2_') ? 'stokenet' : 'mainnet';
  const { items, isLoading } = useCollectionNfts(resourceAddress, true, network, localIds, true);
  const name = collectionName || truncateAddress(resourceAddress, 10, 6);

  if (isLoading && items.length === 0) {
    return (
      <p className="text-xs py-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {loadingLabel}
      </p>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
      {items.map((card) => {
        const active = selectedId.trim() === card.id;
        return (
          <ResourceCard
            key={card.id}
            isActive={active}
            disabled={disabled}
            onClick={() => onSelect(active ? '' : card.id)}
            name={card.name || name}
            address={card.id}
            iconUrl={card.image || collectionIcon}
          />
        );
      })}
    </div>
  );
}

/**
 * The recipient list as fields: one row per recipient with its account, an
 * optional resource (the default one when empty) and an amount or NFT id,
 * each with its picker; ticking several accounts in the picker adds a row for
 * each. The CSV stays the source of truth, so an uploaded
 * file or a holder split fills the rows, and the rows write the CSV back.
 * Row numbers match the "line N" of the list's error messages.
 */
function parsePositiveBig(raw: string): Big | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  try {
    const val = new Big(cleaned);
    return val.gt(0) ? val : null;
  } catch {
    return null;
  }
}

export function RecipientRows({ csv, onCsvChange, defaultResource = '', holdings, disabled }: RecipientRowsProps) {
  const { language } = useLanguage();
  const dict = useConsoleDictionary();
  const L = dict.recipientRows;
  const [rows, setRows] = useState<Row[]>(() => toRows(csv));
  const [emitted, setEmitted] = useState(csv);
  const [showAll, setShowAll] = useState(false);

  // A CSV that came from elsewhere (a file, a holder split) replaces the rows.
  if (csv !== emitted) {
    setRows(toRows(csv));
    setEmitted(csv);
  }

  const update = (next: Row[]) => {
    const out = toCsv(next);
    setRows(next);
    setEmitted(out);
    onCsvChange(out);
  };
  const edit = (id: number, field: keyof Omit<Row, 'id'>, value: string) =>
    update(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  // Several accounts ticked in the "+" popup: the first fills this row, each
  // other one becomes a row of its own below it, with the same resource and
  // amount. Accounts already in the list are not repeated.
  const addAccounts = (id: number, picked: string[]) => {
    const index = rows.findIndex((r) => r.id === id);
    const origin = rows[index];
    if (!origin) return;
    const taken = new Set(rows.filter((r) => r.id !== id).map((r) => r.account.trim()));
    const fresh = picked.filter((a) => !taken.has(a));
    if (!fresh.length) return;
    const [first, ...others] = fresh;
    const added = others.map((account) => ({ ...emptyRow(), account, resource: origin.resource, value: origin.value }));
    update([...rows.slice(0, index), { ...origin, account: first }, ...added, ...rows.slice(index + 1)]);
    if (added.length) setShowAll(true);
  };
  const remove = (id: number) => {
    const next = rows.filter((r) => r.id !== id);
    update(next.length ? next : [emptyRow()]);
  };

  const visible = showAll ? rows : rows.slice(0, VISIBLE_ROWS);
  // The token each amount is in: the row's own resource, else the default one.
  const trimmedDefault = defaultResource.trim();
  const tokenOf = (row: Row) => row.resource.trim() || trimmedDefault;
  const symbols = useResourceLabels([...visible.map(tokenOf), trimmedDefault].filter(Boolean));
  const defaultResourcePlaceholder = trimmedDefault
    ? symbols[trimmedDefault] || truncateAddress(trimmedDefault, 10, 6)
    : L.resource;

  return (
    <div className="space-y-2">
      {visible.map((row, i) => {
        const rowResource = tokenOf(row);
        const isNft = isNonFungibleResource(rowResource);
        const nftHolding = isNft ? holdings?.nonFungibles.find((nf) => nf.resourceAddress === rowResource) : undefined;
        const showNftCards = Boolean(isNft && nftHolding && nftHolding.ids.length > 0);
        const fungibleHolding = !isNft && rowResource ? holdings?.fungibles.find((f) => f.resourceAddress === rowResource) : undefined;

        let availableForRow: Big | null = null;
        let remainingAfterRow: Big | null = null;
        let isOverBalance = false;
        if (!isNft && rowResource && holdings) {
          const totalHeld = fungibleHolding ? new Big(fungibleHolding.amount) : new Big(0);
          let otherUsed = new Big(0);
          for (const other of rows) {
            if (other.id === row.id || tokenOf(other) !== rowResource) continue;
            const amt = parsePositiveBig(other.value);
            if (amt) otherUsed = otherUsed.plus(amt);
          }
          availableForRow = totalHeld.gt(otherUsed) ? totalHeld.minus(otherUsed) : new Big(0);
          const typed = parsePositiveBig(row.value);
          remainingAfterRow = typed ? availableForRow.minus(typed) : availableForRow;
          isOverBalance = typed !== null && typed.gt(availableForRow);
        }

        const fmtBig = (v: Big) => {
          const clamped = v.lt(0) ? new Big(0) : v;
          const n = Number(clamped.toFixed());
          return formatNumber(n, n >= 100 ? 2 : 4, language);
        };
        const symbolLabel = rowResource ? symbols[rowResource] ?? '…' : L.noToken;
        return (
          <div key={row.id} className="space-y-2">
            <div
              className={`grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] gap-2 items-start ${
                showNftCards
                  ? 'sm:grid-cols-[1.75rem_minmax(0,2fr)_minmax(0,1.5fr)_1.75rem]'
                  : 'sm:grid-cols-[1.75rem_minmax(0,1.9fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_1.75rem]'
              }`}
            >
              <span className="pt-2.5 text-right text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                {i + 1}
              </span>
              <AddressField
                categories={['account']}
                value={row.account}
                onChange={(v) => edit(row.id, 'account', v)}
                placeholder={L.account}
                disabled={disabled}
                pickerSelected={row.account.trim() ? [row.account.trim()] : []}
                onPickerConfirm={(picked) => addAccounts(row.id, picked)}
              />
              <div className="col-start-2 sm:col-start-auto">
                <AddressField
                  categories={['resource']}
                  pickerSendableOnly
                  value={row.resource}
                  onChange={(v) => edit(row.id, 'resource', v)}
                  placeholder={defaultResourcePlaceholder}
                  disabled={disabled}
                />
              </div>
              {!showNftCards && (
                <div className="col-start-2 sm:col-start-auto">
                  <TextField
                    value={row.value}
                    onChange={(v) => edit(row.id, 'value', v)}
                    // An NFT is picked by id: a plain number becomes #n# when the field is left.
                    onBlur={() => {
                      const typed = row.value.trim();
                      if (isNft && /^\d+$/.test(typed)) edit(row.id, 'value', `#${typed}#`);
                    }}
                    placeholder={rowResource ? (isNft ? L.nftId : L.amount) : L.value}
                    disabled={disabled}
                    reserveMessage
                    error={
                      isOverBalance && availableForRow
                        ? dict.atomicSwap.insufficientBalanceError.replace('{max}', fmtBig(availableForRow))
                        : undefined
                    }
                    trailingPadding={remainingAfterRow ? 'pr-32' : 'pr-20'}
                    trailing={
                      availableForRow && remainingAfterRow ? (
                        <button
                          type="button"
                          onClick={() => edit(row.id, 'value', availableForRow.toFixed())}
                          disabled={disabled}
                          className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors hover:opacity-80 cursor-pointer tabular-nums max-w-[7.5rem] truncate"
                          style={{
                            background: isOverBalance
                              ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)'
                              : 'rgba(var(--color-primary-rgb), 0.12)',
                            color: isOverBalance ? 'var(--color-danger)' : 'var(--color-primary)',
                          }}
                          title={`${availableForRow.toFixed()} ${symbolLabel}`}
                        >
                          {`${fmtBig(remainingAfterRow)} ${symbolLabel}`}
                        </button>
                      ) : (
                        // What the number is in: the token's symbol, or its name when it has none.
                        <span
                          className="block max-w-[4.5rem] truncate text-[11px] font-bold"
                          style={{ color: rowResource ? 'var(--color-text-muted)' : 'var(--color-danger)' }}
                          title={rowResource || L.noToken}
                        >
                          {symbolLabel}
                        </span>
                      )
                    }
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(row.id)}
                disabled={disabled}
                aria-label={L.remove}
                title={L.remove}
                className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto mt-2 grid size-7 place-items-center rounded-lg transition-opacity hover:opacity-70 disabled:opacity-30"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X className="size-4" />
              </button>
            </div>
            {showNftCards && nftHolding && (
              <div className="pl-9 pr-9">
                <NftRowCards
                  resourceAddress={rowResource}
                  selectedId={row.value}
                  onSelect={(id) => edit(row.id, 'value', id)}
                  localIds={nftHolding.ids}
                  collectionName={nftHolding.name || symbols[rowResource] || ''}
                  collectionIcon={nftHolding.iconUrl}
                  loadingLabel={dict.atomicSwap.loadingNfts}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        );
      })}
      {!showAll && rows.length > VISIBLE_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs font-bold hover:opacity-70"
          style={{ color: 'var(--color-primary)' }}
        >
          {L.showAll.replace('{count}', String(rows.length - VISIBLE_ROWS))}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setShowAll(true);
          update([...rows, emptyRow()]);
        }}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-70 disabled:opacity-40"
        style={{ color: 'var(--color-primary)' }}
      >
        <Plus className="size-3.5" />
        {L.add}
      </button>
    </div>
  );
}
