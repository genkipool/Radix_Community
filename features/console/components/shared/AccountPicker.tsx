'use client';

import { useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { OptionButtons } from './OptionButtons';

interface AccountPickerProps {
  value: string | null;
  onChange: (address: string) => void;
  disabled?: boolean;
}

/** Selectable buttons for the accounts shared by the connected wallet. */
export function AccountPicker({ value, onChange, disabled }: AccountPickerProps) {
  const { accounts } = useRadixWallet();

  // Auto-select: keep the selection valid for the active network's accounts.
  useEffect(() => {
    if (accounts.length === 0) return;
    if (!value || !accounts.some((a) => a.address === value)) {
      onChange(accounts[0].address);
    }
  }, [accounts, value, onChange]);

  return (
    <OptionButtons
      options={accounts.map((account, index) => ({
        value: account.address,
        label: account.label || `Account ${index + 1}`,
        description: truncateAddress(account.address, 8, 6),
        icon: <Wallet className="size-4 shrink-0" />,
      }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
