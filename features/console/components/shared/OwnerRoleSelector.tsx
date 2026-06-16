'use client';

import { useState } from 'react';
import { Ban, BadgeCheck, Users, Search } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { truncateAddress } from '@/utils/formatters';
import type { AccessRule, OwnerRoleUpdatable } from '../../lib/access-rules';
import type { AccountHoldings } from '../../types/console.types';
import type { ConsoleCommonDictionary } from '../../types/i18n.types';
import { OptionButtons } from './OptionButtons';
import { SelectField } from './fields';

export type OwnerRoleKind = 'none' | 'allowAll' | 'badge';

export const ANY_NFT = 'any';

export interface OwnerRoleState {
  kind: OwnerRoleKind;
  updatable: OwnerRoleUpdatable;
  badgeResource: string;
  badgeNftId: string;
}

export const DEFAULT_OWNER_ROLE: OwnerRoleState = {
  kind: 'none',
  updatable: 'Updatable',
  badgeResource: '',
  badgeNftId: ANY_NFT,
};

/**
 * Maps the selector state onto a manifest AccessRule. Returns null while a
 * badge rule is selected but no badge resource has been chosen yet.
 */
export function resolveAccessRule(
  state: OwnerRoleState,
  holdings: AccountHoldings | undefined,
): AccessRule | null {
  if (state.kind === 'none') return { type: 'none' };
  if (state.kind === 'allowAll') return { type: 'allowAll' };
  if (!state.badgeResource || !holdings) return null;

  if (holdings.fungibles.some((f) => f.resourceAddress === state.badgeResource)) {
    return { type: 'fungible', address: state.badgeResource };
  }
  const nonFungible = holdings.nonFungibles.find(
    (nf) => nf.resourceAddress === state.badgeResource,
  );
  if (!nonFungible) return null;
  // "Any" non-fungible of the resource behaves like a fungible-style rule
  return state.badgeNftId === ANY_NFT
    ? { type: 'fungible', address: state.badgeResource }
    : { type: 'nonFungible', address: `${state.badgeResource}:${state.badgeNftId}` };
}

interface OwnerRoleSelectorProps {
  t: ConsoleCommonDictionary;
  holdings: AccountHoldings | undefined;
  value: OwnerRoleState;
  onChange: (value: OwnerRoleState) => void;
  disabled?: boolean;
}

/** Owner-role controls: rule kind, updatability and badge resource. */
export function OwnerRoleSelector({ t, holdings, value, onChange, disabled }: OwnerRoleSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedNonFungible = holdings?.nonFungibles.find(
    (nf) => nf.resourceAddress === value.badgeResource,
  );

  const badgeOptions = [
    ...(holdings?.fungibles ?? []).map((f) => ({
      value: f.resourceAddress,
      name: f.name || f.symbol || 'Unnamed resource',
      iconUrl: f.iconUrl,
      address: truncateAddress(f.resourceAddress, 8, 6),
    })),
    ...(holdings?.nonFungibles ?? []).map((nf) => ({
      value: nf.resourceAddress,
      name: nf.name || 'Unnamed resource',
      iconUrl: nf.iconUrl,
      address: truncateAddress(nf.resourceAddress, 8, 6),
    })),
  ];

  const filteredBadgeOptions = badgeOptions.filter((opt) =>
    opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t.ownerRoleHint}</p>
        <OptionButtons
          options={[
            { value: 'none', label: t.ownerRole_none, icon: <Ban className="size-4" /> },
            { value: 'allowAll', label: t.ownerRole_allowAll, icon: <Users className="size-4" /> },
            { value: 'badge', label: t.ownerRole_badge, icon: <BadgeCheck className="size-4" /> },
          ]}
          value={value.kind}
          onChange={(kind) => onChange({ ...value, kind, badgeResource: '', badgeNftId: ANY_NFT })}
          size="sm"
          disabled={disabled}
        />
      </div>

      {value.kind !== 'none' && (
        <div className="flex flex-col gap-4">
          <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {t.ownerRoleUpdatable}
          </span>
          <OptionButtons
            options={[
              { value: 'None', label: t.updatable_None },
              { value: 'Updatable', label: t.updatable_Updatable },
              { value: 'Fixed', label: t.updatable_Fixed },
            ]}
            value={value.updatable}
            onChange={(updatable) => onChange({ ...value, updatable })}
            size="sm"
            disabled={disabled}
          />
        </div>
      )}

      {value.kind === 'badge' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {t.badgeResource}
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded-xl border pl-9 pr-3.5 py-2 text-xs outline-none transition-colors focus:border-[var(--color-primary)] disabled:opacity-50"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
                disabled={disabled}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {filteredBadgeOptions.map((opt) => {
              const isActive = opt.value === value.badgeResource;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, badgeResource: opt.value, badgeNftId: ANY_NFT })}
                  className="group flex items-center justify-start rounded-xl border text-left transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-sm active:scale-95"
                  style={{
                    background: isActive ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-surface)',
                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
                  }}
                  title={opt.value}
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
            {filteredBadgeOptions.length === 0 && (
              <div className="col-span-1 sm:col-span-3 text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                No se encontraron resultados
              </div>
            )}
          </div>

          {selectedNonFungible && (
            <SelectField
              label={t.nonFungibleId}
              value={value.badgeNftId}
              onChange={(badgeNftId) => onChange({ ...value, badgeNftId })}
              options={[
                { value: ANY_NFT, label: t.anyNft },
                ...selectedNonFungible.ids.map((id) => ({ value: id, label: id })),
              ]}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
}
