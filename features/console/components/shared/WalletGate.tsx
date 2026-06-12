'use client';

import { ReactNode } from 'react';
import { Globe, Server, Wallet } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import type { ConsoleCommonDictionary } from '../../types/i18n.types';

interface WalletGateProps {
  t: ConsoleCommonDictionary;
  children: ReactNode;
}

/**
 * Renders its children only when a wallet session exists on the active
 * network; otherwise shows a premium connect prompt with network buttons.
 */
export function WalletGate({ t, children }: WalletGateProps) {
  const { isConnected, isLoading, connect, sessions, switchNetwork } = useRadixWallet();

  if (isConnected) return <>{children}</>;

  const onNetworkClick = (netName: 'mainnet' | 'stokenet', netId: RadixNetworkId) => {
    if (sessions[netName]) {
      switchNetwork(netName);
    } else {
      connect(netId);
    }
  };

  return (
    <div
      className="rounded-3xl border p-10 flex flex-col items-center text-center gap-5 relative overflow-hidden"
      style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)]"
        aria-hidden
      />
      <div className="size-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] shadow-lg">
        <Wallet className="size-7 text-white" />
      </div>
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
          {t.connectTitle}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {t.connectDescription}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onNetworkClick('mainnet', RadixNetworkId.Mainnet)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all hover:-translate-y-px active:scale-95 disabled:opacity-50"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          <Globe className="size-4" style={{ color: 'var(--color-primary)' }} />
          {t.connectMainnet}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onNetworkClick('stokenet', RadixNetworkId.Stokenet)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all hover:-translate-y-px active:scale-95 disabled:opacity-50"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          <Server className="size-4" style={{ color: 'var(--color-primary)' }} />
          {t.connectStokenet}
        </button>
      </div>
    </div>
  );
}
