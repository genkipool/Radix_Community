'use client';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { networkOfAddress } from '../lib/address-network';

type Setter = (next: string[] | ((prev: string[]) => string[])) => void;

/**
 * The part of a list of addresses that belongs to the active network. The
 * other network's addresses are kept aside, untouched: switching back brings
 * them back, and editing the visible list never drops them.
 */
export function useNetworkSelection(values: string[], setValues: Setter): [string[], Setter] {
  const { activeNetwork } = useRadixWallet();
  const onActive = (address: string) => (networkOfAddress(address) ?? activeNetwork) === activeNetwork;
  const visible = values.filter(onActive);
  const setVisible: Setter = (next) =>
    setValues((prev) => {
      const shown = prev.filter(onActive);
      return [...prev.filter((a) => !onActive(a)), ...(typeof next === 'function' ? next(shown) : next)];
    });
  return [visible, setVisible];
}
