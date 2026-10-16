'use client';

import { useEffect, useRef } from 'react';
import { Wallet } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { accountFromQuery } from '../../lib/console-query';
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

  // What the picker chose by itself, so a later, fuller account list can still
  // correct it; a choice the user made is never overridden.
  const autoPicked = useRef<string | null>(null);

  // Auto-select: keep the selection valid for the active network's accounts.
  // The account a link asked for (`?account=`) wins when the wallet has it.
  // Right after a page load the wallet lists its accounts in steps, so the
  // linked one may only show up after a first pick: it then replaces that pick.
  useEffect(() => {
    if (accounts.length === 0) return;
    const linked = accountFromQuery();
    const hasLinked = !!linked && accounts.some((a) => a.address === linked);
    const fallback = hasLinked ? linked! : accounts[0].address;
    if (!multiple && hasLinked && value !== linked && value === autoPicked.current) {
      autoPicked.current = linked;
      (onChange as (v: string) => void)(linked!);
      return;
    }
    if (multiple) {
      const arrValue = value as string[];
      const arrOnChange = onChange as (v: string[]) => void;
      if (!arrValue || arrValue.length === 0) {
        arrOnChange([fallback]);
      } else {
        const validAccounts = arrValue.filter(val => accounts.some(a => a.address === val));
        if (validAccounts.length !== arrValue.length) {
           arrOnChange(validAccounts.length > 0 ? validAccounts : [fallback]);
        }
      }
    } else {
      const strValue = value as string | null;
      const strOnChange = onChange as (v: string) => void;
      if (!strValue || !accounts.some((a) => a.address === strValue)) {
        autoPicked.current = fallback;
        strOnChange(fallback);
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
