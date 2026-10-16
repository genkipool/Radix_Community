'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { useResourceLabels } from '../../hooks/useResourceLabels';
import { isNonFungibleResource } from '../../lib/bulk-send';
import { AddressField, TextField } from '../shared/fields';

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

const TEXT = {
  es: {
    account: 'account_rdx1…',
    resource: 'Recurso por defecto',
    value: 'Cantidad o #id#',
    add: 'Añadir destinatario',
    remove: 'Quitar destinatario',
    showAll: 'Mostrar los {count} restantes',
    noToken: 'token?',
  },
  en: {
    account: 'account_rdx1…',
    resource: 'Default resource',
    value: 'Amount or #id#',
    add: 'Add recipient',
    remove: 'Remove recipient',
    showAll: 'Show the remaining {count}',
    noToken: 'token?',
  },
};

interface RecipientRowsProps {
  csv: string;
  onCsvChange: (csv: string) => void;
  /** The resource a row without one sends, shown in its amount field. */
  defaultResource?: string;
  disabled?: boolean;
}

/**
 * The recipient list as fields: one row per recipient with its account, an
 * optional resource (the default one when empty) and an amount or NFT id,
 * each with its picker; ticking several accounts in the picker adds a row for
 * each. The CSV stays the source of truth, so an uploaded
 * file or a holder split fills the rows, and the rows write the CSV back.
 * Row numbers match the "line N" of the list's error messages.
 */
export function RecipientRows({ csv, onCsvChange, defaultResource = '', disabled }: RecipientRowsProps) {
  const { language } = useLanguage();
  const L = language === 'es' ? TEXT.es : TEXT.en;
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
  const tokenOf = (row: Row) => row.resource.trim() || defaultResource.trim();
  const symbols = useResourceLabels(visible.map(tokenOf).filter(Boolean));

  return (
    <div className="space-y-2">
      {visible.map((row, i) => (
        <div
          key={row.id}
          className="grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] gap-2 sm:grid-cols-[1.75rem_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_1.75rem] items-start"
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
              placeholder={L.resource}
              disabled={disabled}
            />
          </div>
          <div className="col-start-2 sm:col-start-auto">
            <TextField
              value={row.value}
              onChange={(v) => edit(row.id, 'value', v)}
              // An NFT is picked by id: a plain number becomes #n# when the field is left.
              onBlur={() => {
                const typed = row.value.trim();
                if (isNonFungibleResource(tokenOf(row)) && /^\d+$/.test(typed)) edit(row.id, 'value', `#${typed}#`);
              }}
              placeholder={L.value}
              disabled={disabled}
              trailingPadding="pr-20"
              trailing={
                // What the number is in: the token's symbol, or its name when it has none.
                <span
                  className="block max-w-[4.5rem] truncate text-[11px] font-bold"
                  style={{ color: tokenOf(row) ? 'var(--color-text-muted)' : 'var(--color-danger)' }}
                  title={tokenOf(row) || L.noToken}
                >
                  {tokenOf(row) ? symbols[tokenOf(row)] ?? '…' : L.noToken}
                </span>
              }
            />
          </div>
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
      ))}
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
