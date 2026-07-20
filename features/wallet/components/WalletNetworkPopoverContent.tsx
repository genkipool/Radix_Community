'use client';

import { Globe, Server } from 'lucide-react';
import type { Dictionary } from '@/i18n';
import { RadixNetworkId } from '../constants/network';

/**
 * Network-select content shared by the Navbar wallet button and the inline
 * "connect wallet" popovers. Lets the user pick Mainnet/Stokenet (or switch to
 * an existing session) and cancel a pending connection.
 */
export function WalletNetworkPopoverContent({
  connect,
  t,
  sessions,
  switchNetwork,
  isLoading,
  disconnect,
}: {
  connect: (networkId: RadixNetworkId, isUpdate?: boolean) => void;
  t: Dictionary;
  sessions: Record<'mainnet' | 'stokenet', unknown>;
  switchNetwork: (network: 'mainnet' | 'stokenet') => void;
  isLoading: boolean;
  disconnect: () => void;
}) {
  const onNetworkClick = (netName: 'mainnet' | 'stokenet', netId: RadixNetworkId) => {
    if (sessions[netName]) {
      switchNetwork(netName);
    } else {
      connect(netId);
    }
  };

  return (
    <div className="p-4 w-[280px]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 px-1">
        {t.nav?.wallet_select_network ?? 'Select Network'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onNetworkClick('mainnet', RadixNetworkId.Mainnet)}
          className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl hover:bg-[var(--color-surface)] active:scale-95 transition-all cursor-pointer border border-[var(--color-card-border)] hover:border-[var(--color-accent)] group"
          disabled={isLoading}
        >
          <Globe className="size-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-text-main)]">{t.nav?.wallet_mainnet ?? 'Mainnet'}</span>
        </button>
        <button
          type="button"
          onClick={() => onNetworkClick('stokenet', RadixNetworkId.Stokenet)}
          className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl hover:bg-[var(--color-surface)] active:scale-95 transition-all cursor-pointer border border-[var(--color-card-border)] hover:border-[var(--color-accent)] group"
          disabled={isLoading}
        >
          <Server className="size-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-text-main)]">{t.nav?.wallet_stokenet ?? 'Stokenet'}</span>
        </button>
      </div>
      {isLoading && (
        <button
          type="button"
          onClick={() => disconnect()}
          className="mt-4 w-full py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:text-red-500 transition-colors text-center"
        >
          {t.nav?.wallet_cancel_connection ?? 'Cancelar conexión'}
        </button>
      )}
    </div>
  );
}
