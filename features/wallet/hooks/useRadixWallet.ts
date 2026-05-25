import { useContext } from 'react';
import { RadixWalletContext } from '@/features/wallet/context/RadixWalletProvider';

export function useRadixWallet() {
  const context = useContext(RadixWalletContext);
  if (context === undefined) {
    throw new Error('useRadixWallet must be used within a RadixWalletProvider');
  }
  return context;
}
