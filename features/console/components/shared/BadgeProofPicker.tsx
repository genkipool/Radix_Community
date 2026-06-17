'use client';

import { useState, useEffect } from 'react';
import { truncateAddress } from '@/utils/formatters';
import type { AccountHoldings, BadgeProofSelection } from '../../types/console.types';
import { ResourceCard } from './ResourceCard';
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
  requiredBadges?: string[];
  rolesLoading?: boolean;
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
  requiredBadges,
  rolesLoading,
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

  const allowedOptions = requiredBadges && requiredBadges.length > 0
    ? allOptions.filter((opt) => opt.value !== NONE && requiredBadges.includes(opt.value.split(NFT_SEPARATOR)[0]))
    : allOptions.filter((opt) => opt.value === NONE);

  const filteredOptions = allowedOptions.filter((opt) =>
    opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const encoded = value
    ? value.nonFungibleId
      ? `${value.resourceAddress}${NFT_SEPARATOR}${value.nonFungibleId}`
      : value.resourceAddress
    : NONE;

  // Stable key for auto-selection (avoids re-triggering on every render)
  const allowedKey = allowedOptions.map(o => o.value).join(',');

  // Auto-selection: whenever the allowed options change, pick the first one
  // if the current selection is not among them.
  useEffect(() => {
    if (rolesLoading) return;

    const allowedValues = allowedKey ? allowedKey.split(',') : [];
    const currentlyValid = allowedValues.includes(encoded);
    if (currentlyValid) return;

    // Auto-select the first allowed option
    const first = allowedValues[0];
    if (first === undefined) {
      onChange(null);
    } else if (first === NONE) {
      onChange(null);
    } else {
      const [resourceAddress, nonFungibleId] = first.split(NFT_SEPARATOR);
      onChange({ accountAddress: accountAddress!, resourceAddress, nonFungibleId });
    }
  }, [rolesLoading, allowedKey, encoded, accountAddress, onChange]);

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
            <ResourceCard
            key={opt.value}
            isActive={isActive}
            disabled={disabled || !accountAddress}
            onClick={() => handleChange(isActive ? NONE : opt.value)}
            name={opt.name}
            address={opt.address}
            fullAddress={opt.value.includes(NFT_SEPARATOR) ? opt.value.split(NFT_SEPARATOR)[0] : (opt.value || undefined)}
            iconUrl={opt.iconUrl}
          />
          );
        })}
        {allowedOptions.length === 0 && requiredBadges && requiredBadges.length > 0 && !rolesLoading ? (
          <div className="col-span-1 sm:col-span-3">
            <ResourceCard
              isActive={false}
              disabled={true}
              onClick={() => {}}
              name="Prueba requerida faltante"
              address={requiredBadges.map(b => truncateAddress(b, 6, 4)).join(', ')}
              fullAddress={requiredBadges[0]}
              iconUrl=""
            />
          </div>
        ) : filteredOptions.length === 0 && (
          <div className="col-span-1 sm:col-span-3 text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No se encontraron resultados
          </div>
        )}
      </div>
    </div>
  );
}
