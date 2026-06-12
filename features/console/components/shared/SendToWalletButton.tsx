'use client';

import { Send } from 'lucide-react';

interface SendToWalletButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  loadingLabel: string;
}

/** Primary CTA that submits a transaction manifest to the Radix Wallet. */
export function SendToWalletButton({
  onClick,
  disabled = false,
  loading = false,
  label,
  loadingLabel,
}: SendToWalletButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 hover:-translate-y-px active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
    >
      {loading ? (
        <>
          <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Send className="size-4" />
          {label}
        </>
      )}
    </button>
  );
}
