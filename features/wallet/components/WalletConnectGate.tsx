'use client';

import type { ReactNode } from 'react';
import { ShieldCheck, Wallet } from 'lucide-react';
import { RadixNetworkId } from '../constants/network';
import { useRadixWallet } from '../hooks/useRadixWallet';

/**
 * Renders children only when a wallet session is active; else a connect
 * prompt. Labels come from the calling feature's dictionary so the gate can
 * explain WHY the wallet is needed in that context.
 */
export function WalletConnectGate({
  title,
  subtitle,
  mainnetLabel,
  stokenetLabel,
  children,
}: {
  title: string;
  subtitle: string;
  mainnetLabel: string;
  stokenetLabel: string;
  children: ReactNode;
}) {
  const { isConnected, isLoading, connect } = useRadixWallet();
  if (isConnected) return <>{children}</>;

  return (
    <div
      className="rounded-3xl border p-10 flex flex-col items-center text-center gap-5"
      style={{
        background: 'var(--color-card-bg)',
        borderColor: 'var(--color-card-border)',
      }}
    >
      <div className="size-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] shadow-lg">
        <Wallet className="size-7 text-white" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-main)' }}>
          {title}
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {subtitle}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => connect(RadixNetworkId.Mainnet)}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          <ShieldCheck className="size-4" />
          {mainnetLabel}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => connect(RadixNetworkId.Stokenet)}
          className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95 disabled:opacity-40"
          style={{
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          {stokenetLabel}
        </button>
      </div>
    </div>
  );
}
