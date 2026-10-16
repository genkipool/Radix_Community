'use client';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';

const NETWORKS = ['mainnet', 'stokenet'] as const;
const LABELS: Record<(typeof NETWORKS)[number], string> = {
  mainnet: 'MAINNET',
  stokenet: 'STOKENET',
};

/** Mainnet/stokenet switch: takes the free width of the console sidebar controls row. */
export function NetworkSwitch() {
  const { activeNetwork, switchNetwork } = useRadixWallet();

  return (
    <div
      className="flex flex-1 min-w-0 items-center h-8 p-0.5 rounded-lg"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}
      role="group"
      aria-label="Network"
    >
      {NETWORKS.map((network) => {
        const isActive = activeNetwork === network;
        return (
          <button
            key={network}
            type="button"
            title={network === 'mainnet' ? 'Mainnet' : 'Stokenet'}
            aria-pressed={isActive}
            onClick={() => switchNetwork(network)}
            className="h-full flex-1 px-2 rounded-md text-[10px] font-sans font-bold tracking-wide transition-all duration-150 cursor-pointer"
            style={{
              background: isActive ? 'var(--color-accent)' : 'transparent',
              color: isActive ? 'var(--color-bg)' : 'var(--color-text-muted)',
            }}
          >
            {LABELS[network]}
          </button>
        );
      })}
    </div>
  );
}
