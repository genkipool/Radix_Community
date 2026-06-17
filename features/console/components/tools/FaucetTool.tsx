'use client';

import { useState } from 'react';
import { Droplets, Server } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useKnownAddresses } from '../../hooks/useKnownAddresses';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { AccountPicker } from '../shared/AccountPicker';
import { TxResultBanner } from '../shared/TxResultBanner';

const freeXrdManifest = (faucet: string, accounts: string[]) => {
  return accounts.map(account => `
CALL_METHOD
    Address("${faucet}")
    "free"
;
CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`).join('\n');
};

/** Stokenet faucet: one click to fund a test account with 10,000 XRD. */
export default function FaucetTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.faucet;
  const { activeNetwork, switchNetwork, isLoading: walletLoading } = useRadixWallet();
  const { data: knownAddresses } = useKnownAddresses();

  const [accounts, setAccounts] = useState<string[]>([]);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();

  if (activeNetwork !== 'stokenet') {
    return (
      <div
        className="rounded-3xl border p-10 flex flex-col items-center text-center gap-4"
        style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
      >
        <Server className="size-8" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {labels.mainnetNotice}
        </p>
        <button
          type="button"
          onClick={() => switchNetwork('stokenet')}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 cursor-pointer"
        >
          {labels.switchToStokenet}
        </button>
      </div>
    );
  }

  const faucet = knownAddresses?.faucet ?? '';

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <header className="space-y-1">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
            {labels.accountTitle}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.hint}
          </p>
        </header>
        <AccountPicker multiple value={accounts} onChange={setAccounts} disabled={isSending} />
      </div>

      <TxResultBanner t={common} result={result} error={error} onReset={reset} />

      <button
        type="button"
        disabled={accounts.length === 0 || !faucet || isSending || walletLoading}
        onClick={() => accounts.length > 0 && sendTransaction(freeXrdManifest(faucet, accounts))}
        title={labels.buttonHint}
        className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        {isSending ? (
          <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        ) : (
          <Droplets className="size-4" />
        )}
        {labels.button}
      </button>
    </div>
  );
}
