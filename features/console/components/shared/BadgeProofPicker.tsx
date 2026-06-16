'use client';

import { useState } from 'react';
import { truncateAddress } from '@/utils/formatters';
import type { AccountHoldings, BadgeProofSelection } from '../../types/console.types';
import { SafeImage } from '@/components/ui/SafeImage';
import { SearchField } from './fields';

interface BadgeProofPickerProps {
  label: string;
  noneLabel: string;
  accountAddress: string | null;
  holdings: AccountHoldings | undefined;
  value: BadgeProofSelection | null;
  onChange: (value: BadgeProofSelection | null) => void;
  disabled?: boolean;
  hint?: string;
}

const NONE = '';
const NFT_SEPARATOR = '|';

export function BadgeProofPicker({
  label,
  noneLabel,
  accountAddress,
  holdings,
  value,
  onChange,
  disabled,
  hint,
}: BadgeProofPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const allOptions = [
    { value: NONE, name: noneLabel, address: 'Ninguna', iconUrl: '' },
    ...(holdings?.fungibles ?? []).map((f) => ({
      value: f.resourceAddress,
      name: f.name || f.symbol || 'Unnamed resource',
      address: truncateAddress(f.resourceAddress, 8, 6),
      iconUrl: f.iconUrl,
    })),
    ...(holdings?.nonFungibles ?? []).flatMap((nf) =>
      nf.ids.map((id) => ({
        value: `${nf.resourceAddress}${NFT_SEPARATOR}${id}`,
        name: `${nf.name || 'Unnamed'} — ${id}`,
        address: truncateAddress(nf.resourceAddress, 8, 6),
        iconUrl: nf.iconUrl,
      })),
    ),
  ];

  const filteredOptions = allOptions.filter((opt) =>
    opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const encoded = value
    ? value.nonFungibleId
      ? `${value.resourceAddress}${NFT_SEPARATOR}${value.nonFungibleId}`
      : value.resourceAddress
    : NONE;

  const handleChange = (next: string) => {
    if (!next || !accountAddress || next === NONE) {
      onChange(null);
      return;
    }
    const [resourceAddress, nonFungibleId] = next.split(NFT_SEPARATOR);
    onChange({ accountAddress, resourceAddress, nonFungibleId });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {label}
          </span>
          {hint && <span className="text-[11px] opacity-70 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{hint}</span>}
        </div>
        <SearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar..."
          disabled={disabled || !accountAddress}
        />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {filteredOptions.map((opt) => {
          const isActive = opt.value === encoded;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled || !accountAddress}
              onClick={() => handleChange(isActive ? NONE : opt.value)}
              className="group flex items-center justify-start rounded-xl border text-left transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-sm active:scale-95"
              style={{
                background: isActive ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-surface)',
                borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
              }}
              title={opt.name}
            >
              <div className="grid grid-cols-[auto_1fr] grid-rows-2 gap-x-2.5 gap-y-0.5 w-full p-2">
                <div className="col-start-1 row-span-2 flex items-center justify-center">
                  <SafeImage
                    src={opt.iconUrl}
                    alt={opt.name}
                    fallbackName={opt.name}
                    className="size-9 rounded-full object-cover shadow-sm bg-white/10"
                  />
                </div>
                <div className="col-start-2 row-start-1 truncate font-bold text-xs leading-tight mt-0.5" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                  {opt.name}
                </div>
                <div className="col-start-2 row-start-2 truncate text-[11px] font-medium opacity-70 mb-0.5" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                  {opt.address}
                </div>
              </div>
            </button>
          );
        })}
        {filteredOptions.length === 0 && (
          <div className="col-span-1 sm:col-span-3 text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No se encontraron resultados
          </div>
        )}
      </div>
    </div>
  );
}
