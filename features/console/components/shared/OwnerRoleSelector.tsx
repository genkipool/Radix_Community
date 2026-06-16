'use client';

import { useState } from 'react';
import { Ban, BadgeCheck, Users } from 'lucide-react';
import { truncateAddress } from '@/utils/formatters';
import type { AccessRule, OwnerRoleUpdatable } from '../../lib/access-rules';
import type { AccountHoldings } from '../../types/console.types';
import type { ConsoleCommonDictionary } from '../../types/i18n.types';
import { OptionButtons } from './OptionButtons';
import { SearchField } from './fields';
import { ResourceCard } from './ResourceCard';

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
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar..."
              disabled={disabled}
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {filteredBadgeOptions.map((opt) => {
              const isActive = opt.value === value.badgeResource;
              return (
                <ResourceCard
                  key={opt.value}
                  isActive={isActive}
                  disabled={disabled}
                  onClick={() => onChange({ ...value, badgeResource: isActive ? '' : opt.value, badgeNftId: ANY_NFT })}
                  name={opt.name}
                  address={opt.address}
                  iconUrl={opt.iconUrl}
                  title={opt.value}
                />
              );
            })}
            {filteredBadgeOptions.length === 0 && (
              <div className="col-span-1 sm:col-span-3 text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                No se encontraron resultados
              </div>
            )}
          </div>

          {selectedNonFungible && (
            <div className="flex flex-col gap-3">
              <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {t.nonFungibleId}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {[
                  { value: ANY_NFT, name: t.anyNft, address: selectedNonFungible.name || 'Resource' },
                  ...selectedNonFungible.ids.map((id) => ({ value: id, name: id, address: selectedNonFungible.name || 'Resource' }))
                ].map((opt) => {
                  const isActive = opt.value === value.badgeNftId;
                  return (
                    <ResourceCard
                      key={opt.value}
                      isActive={isActive}
                      disabled={disabled}
                      onClick={() => onChange({ ...value, badgeNftId: isActive ? ANY_NFT : opt.value })}
                      name={opt.name}
                      address={opt.address}
                      iconUrl={selectedNonFungible.iconUrl}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
