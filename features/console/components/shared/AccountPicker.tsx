'use client';

import { useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { OptionButtons } from './OptionButtons';

export type AccountPickerProps = {
  disabled?: boolean;
} & (
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
  | { multiple?: false; value: string | null; onChange: (value: string) => void }
);

/** Selectable buttons for the accounts shared by the connected wallet. */
export function AccountPicker(props: AccountPickerProps) {
  const { disabled, multiple } = props;
  const { accounts } = useRadixWallet();

  const value = props.value;
  const onChange = props.onChange;

  // Auto-select: keep the selection valid for the active network's accounts.
  useEffect(() => {
    if (accounts.length === 0) return;
    if (multiple) {
      const arrValue = value as string[];
      const arrOnChange = onChange as (v: string[]) => void;
      if (!arrValue || arrValue.length === 0) {
        arrOnChange([accounts[0].address]);
      } else {
        const validAccounts = arrValue.filter(val => accounts.some(a => a.address === val));
        if (validAccounts.length !== arrValue.length) {
           arrOnChange(validAccounts.length > 0 ? validAccounts : [accounts[0].address]);
        }
      }
    } else {
      const strValue = value as string | null;
      const strOnChange = onChange as (v: string) => void;
      if (!strValue || !accounts.some((a) => a.address === strValue)) {
        strOnChange(accounts[0].address);
      }
    }
  }, [accounts, multiple, value, onChange]);

  const options = accounts.map((account, index) => ({
    value: account.address,
    label: account.label || `Account ${index + 1}`,
    description: truncateAddress(account.address, 8, 6),
    icon: <Wallet className="size-4 shrink-0" />,
  }));

  if (multiple) {
    return (
      <OptionButtons
        multiple
        options={options}
        value={props.value}
        onChange={props.onChange}
        disabled={disabled}
      />
    );
  }

  return (
    <OptionButtons
      multiple={false}
      options={options}
      value={props.value}
      onChange={props.onChange}
      disabled={disabled}
    />
  );
}
