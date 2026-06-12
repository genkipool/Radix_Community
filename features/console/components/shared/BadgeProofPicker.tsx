'use client';

import { truncateAddress } from '@/utils/formatters';
import type { AccountHoldings, BadgeProofSelection } from '../../types/console.types';
import { SelectField } from './fields';

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

/**
 * Optional badge-proof selector. A native select is intentionally used here:
 * the list (every fungible plus every NFT of the account) can be arbitrarily
 * long, which button groups handle poorly.
 */
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
  const options = [
    { value: NONE, label: noneLabel },
    ...(holdings?.fungibles ?? []).map((f) => ({
      value: f.resourceAddress,
      label: `${f.name || f.symbol || 'Unnamed resource'} (${truncateAddress(f.resourceAddress, 8, 6)})`,
    })),
    ...(holdings?.nonFungibles ?? []).flatMap((nf) =>
      nf.ids.map((id) => ({
        value: `${nf.resourceAddress}${NFT_SEPARATOR}${id}`,
        label: `${nf.name || 'Unnamed resource'} — ${id}`,
      })),
    ),
  ];

  const encoded = value
    ? value.nonFungibleId
      ? `${value.resourceAddress}${NFT_SEPARATOR}${value.nonFungibleId}`
      : value.resourceAddress
    : NONE;

  const handleChange = (next: string) => {
    if (!next || !accountAddress) {
      onChange(null);
      return;
    }
    const [resourceAddress, nonFungibleId] = next.split(NFT_SEPARATOR);
    onChange({ accountAddress, resourceAddress, nonFungibleId });
  };

  return (
    <SelectField
      label={label}
      hint={hint}
      value={encoded}
      onChange={handleChange}
      options={options}
      disabled={disabled || !accountAddress}
    />
  );
}
