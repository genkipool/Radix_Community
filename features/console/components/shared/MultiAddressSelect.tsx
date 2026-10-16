'use client';

import { useState, type ReactNode } from 'react';
import { useQueries } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import type { AddressCategory } from '@/features/wallet/hooks/useAddressBook';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { networkOfAddress } from '../../lib/address-network';
import { getMetadataString, type GatewayMetadataItem } from '../../lib/metadata-manifests';
import { truncateAddress } from '@/utils/formatters';
import { consoleQueryParam } from '../../lib/console-query';
import { OptionButtons } from './OptionButtons';
import { AddressField } from './fields';

/** Most entities one view loads at once: each is a few Gateway requests. */
export const MAX_SELECTED = 10;

/** `?pool=a,b` on the tool URL: a link can open one or several entities directly. */
export const addressesFromUrl = (param: string): string[] =>
  [...new Set((consoleQueryParam(param) ?? '').split(',').map((a) => a.trim()).filter(Boolean))].slice(0, MAX_SELECTED);

/** A whole address of this kind: bech32m, 30 bytes, so always 54 characters after the separator. */
const isComplete = (address: string, kind: string) =>
  new RegExp(`^${kind}_(rdx|tdx_2_)1[02-9ac-hj-np-z]{54}$`).test(address);

const TEXT = {
  es: {
    hint: 'Pega una dirección o pulsa + para elegir varias.',
    full: 'Ya hay {max} seleccionados: quita alguno para añadir más.',
    remove: 'Quitar',
  },
  en: {
    hint: 'Paste an address or press + to pick several.',
    full: '{max} are already selected: remove one to add more.',
    remove: 'Remove',
  },
};

interface MultiAddressSelectProps {
  label: ReactNode;
  /** One address family, e.g. `pool`: its prefix is how a pasted address is recognised. */
  kind: Extract<AddressCategory, 'pool' | 'locker' | 'validator'>;
  values: string[];
  onChange: (values: string[]) => void;
  /** The account's own entities, offered as one-tap toggles above the input. */
  suggestions?: Array<{ address: string; label: string; description?: string }>;
  /** The suggestions are still loading: their place is held, so the field below does not jump when they arrive. */
  suggestionsLoading?: boolean;
  placeholder: string;
  disabled?: boolean;
}

/**
 * Picks several entities of one kind for a read-only view. The account's own
 * entities are one-tap toggles above the input; a pasted address is added as
 * soon as it is complete; the "+" popup ticks several and adds them with its
 * button, lists the picked ones first when it opens again, and drops one the
 * moment it is unticked. Picks the toggles do not show appear as chips, and
 * every pick is a card in the view, removable from there too.
 */
export function MultiAddressSelect({ label, kind, values, onChange, suggestions = [], suggestionsLoading = false, placeholder, disabled }: MultiAddressSelectProps) {
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const [draft, setDraft] = useState('');
  const L = language === 'es' ? TEXT.es : TEXT.en;
  const full = values.length >= MAX_SELECTED;


  const type = (value: string) => {
    const address = value.trim();
    // Added the moment it is whole and on this network; a wrong network stays in the field, flagged.
    if (isComplete(address, kind) && networkOfAddress(address) === activeNetwork && !full) {
      if (!values.includes(address)) onChange([...values, address]);
      setDraft('');
      return;
    }
    setDraft(value);
  };

  const suggested = suggestions.map((s) => s.address);
  // Every pick the toggles do not show, as a chip, so a pasted address stays
  // in sight after the input clears for the next one.
  const others = values.filter((v) => !suggested.includes(v));
  const nameQueries = useQueries({
    queries: others.map((address) => ({
      queryKey: ['console-entity-name', activeNetwork, address],
      staleTime: 5 * 60_000,
      retry: false,
      queryFn: async () => {
        const details = (await apiFetchEntityDetails(address, activeNetwork)) as unknown as {
          metadata?: { items?: GatewayMetadataItem[] };
        };
        return getMetadataString(details.metadata?.items, 'name');
      },
    })),
  });
  const fullHint = L.full.replace('{max}', String(MAX_SELECTED));

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      {suggestionsLoading && suggestions.length === 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-busy>
          {[0, 1].map((n) => (
            <span key={n} className="block h-[52px] rounded-xl animate-pulse" style={{ background: 'var(--color-card-border)' }} />
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <OptionButtons
          multiple
          layout="grid"
          className="sm:grid-cols-2"
          size="sm"
          options={suggestions.map((s) => ({
            value: s.address,
            label: s.label,
            description: s.description,
            title: s.address,
            disabled: full && !values.includes(s.address),
          }))}
          value={values.filter((v) => suggested.includes(v))}
          // Keeps the order things were picked in: unticked ones leave, new ones go last.
          onChange={(next) =>
            onChange([...values.filter((v) => !suggested.includes(v) || next.includes(v)), ...next.filter((v) => !values.includes(v))])
          }
          disabled={disabled}
        />
      )}
      <AddressField
        categories={[kind]}
        value={draft}
        onChange={type}
        placeholder={placeholder}
        hint={full ? fullHint : L.hint}
        reserveMessage
        disabled={disabled}
        pickerSelected={values}
        onPickerConfirm={(next) => onChange(next.slice(0, MAX_SELECTED))}
      />
      {others.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {others.map((address, i) => {
            const name = nameQueries[i]?.data;
            return (
              <li
                key={address}
                title={address}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border py-1 pl-3 pr-1 text-xs"
                style={{ borderColor: 'var(--color-card-border)', background: 'var(--color-surface)', color: 'var(--color-text-main)' }}
              >
                <span className="min-w-0 truncate">
                  {name && <span className="font-semibold">{name} </span>}
                  <span className="font-mono" style={{ color: 'var(--color-text-muted)' }}>{truncateAddress(address, 12, 6)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onChange(values.filter((v) => v !== address))}
                  disabled={disabled}
                  aria-label={`${L.remove} ${address}`}
                  className="grid size-6 shrink-0 place-items-center rounded-md transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
