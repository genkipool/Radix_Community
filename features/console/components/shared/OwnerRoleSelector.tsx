'use client';

import { Ban, BadgeCheck, Users } from 'lucide-react';
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
  const selectedNonFungible = holdings?.nonFungibles.find(
    (nf) => nf.resourceAddress === value.badgeResource,
  );

  const badgeOptions = [
    ...(holdings?.fungibles ?? []).map((f) => ({
      value: f.resourceAddress,
      label: `${f.name || f.symbol || 'Unnamed resource'} (${truncateAddress(f.resourceAddress, 8, 6)})`,
    })),
    ...(holdings?.nonFungibles ?? []).map((nf) => ({
      value: nf.resourceAddress,
      label: `${nf.name || 'Unnamed resource'} (${truncateAddress(nf.resourceAddress, 8, 6)})`,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
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
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.ownerRoleHint}</p>
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
        <>
          <SelectField
            label={t.badgeResource}
            placeholder={t.selectBadge}
            value={value.badgeResource}
            onChange={(badgeResource) => onChange({ ...value, badgeResource, badgeNftId: ANY_NFT })}
            options={badgeOptions}
            disabled={disabled}
          />
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
        </>
      )}
    </div>
  );
}
