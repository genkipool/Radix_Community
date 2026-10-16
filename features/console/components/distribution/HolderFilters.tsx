'use client';

import { normalizeDecimal } from '../../lib/decimal';
import { filterHolders, holderKind, type Holder, type HolderKind } from '../../lib/resource-holders';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { OptionButtons } from '../shared/OptionButtons';
import { TextAreaField, TextField } from '../shared/fields';

const KINDS: HolderKind[] = ['account', 'pool', 'locker', 'component', 'validator'];

export interface HolderFilterState {
  kinds: HolderKind[];
  minAmount: string;
  exclude: string;
}

export const DEFAULT_HOLDER_FILTER: HolderFilterState = { kinds: ['account'], minAmount: '', exclude: '' };

/** The holders that pass the filter, in Gateway order (largest first). */
export function applyHolderFilter(holders: Holder[], filter: HolderFilterState): Holder[] {
  return filterHolders(holders, {
    kinds: filter.kinds,
    minAmount: Number(normalizeDecimal(filter.minAmount)) || 0,
    exclude: filter.exclude.split(/[\s,]+/),
  });
}

interface HolderFiltersProps {
  t: ConsoleDictionary;
  holders: Holder[];
  value: HolderFilterState;
  onChange: (value: HolderFilterState) => void;
}

/** Which holders count: by kind of holder, a minimum balance and a list of exclusions. */
export function HolderFilters({ t, holders, value, onChange }: HolderFiltersProps) {
  const labels = t.holders;
  return (
    <div className="space-y-3">
      <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {labels.filtersTitle}
      </span>
      <OptionButtons<HolderKind>
        multiple
        size="sm"
        options={KINDS.map((k) => ({
          value: k,
          label: `${labels.kinds[k]} (${holders.filter((h) => holderKind(h.address) === k).length})`,
        }))}
        value={value.kinds}
        onChange={(kinds) => onChange({ ...value, kinds })}
      />
      <TextField
        label={labels.minAmount}
        value={value.minAmount}
        onChange={(minAmount) => onChange({ ...value, minAmount })}
        placeholder="0"
      />
      <TextAreaField
        label={labels.exclude}
        hint={labels.excludeHint}
        value={value.exclude}
        onChange={(exclude) => onChange({ ...value, exclude })}
        rows={2}
        mono
      />
    </div>
  );
}
