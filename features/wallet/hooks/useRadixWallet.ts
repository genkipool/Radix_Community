import { use } from 'react';
import { RadixWalletContext } from '@/features/wallet/context/RadixWalletProvider';

export function useRadixWallet() {
  const context = use(RadixWalletContext);
  if (context === undefined) {
    throw new Error('useRadixWallet must be used within a RadixWalletProvider');
  }
  return context;
}
