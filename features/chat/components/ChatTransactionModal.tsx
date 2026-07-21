'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { AccountPicker } from '@/features/console/components/shared/AccountPicker';
import {
  TransactionBuilder,
  type SentTransactionSummary,
} from '@/features/wallet/components/TransactionBuilder';
import type { ChatDictionary } from '../types/dictionary';

/**
 * Send-transaction modal launched from the chat header. It reuses the exact
 * transfer builder from the console's send-transaction tool (destination input,
 * the "+" token/NFT selection popup and the send button), with the peer's
 * address pre-filled as the destination. Rendered as a portal overlay so
 * opening it, or sending a transaction, never unmounts the live chat session.
 */
export function ChatTransactionModal({
  t,
  peerAccount,
  onClose,
  onTransactionSent,
}: {
  t: ChatDictionary;
  peerAccount: string;
  onClose: () => void;
  /** Fires when the transfer commits; the chat announces it, then we close. */
  onTransactionSent: (summary: SentTransactionSummary) => void;
}) {
  const { t: fullDictionary, language } = useLanguage();
  const { accounts } = useRadixWallet();
  const [account, setAccount] = useState<string | null>(
    accounts[0]?.address ?? null,
  );

  if (typeof document === 'undefined') return null;

  const handleSent = (summary: SentTransactionSummary) => {
    onTransactionSent(summary);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex overflow-y-auto bg-black/70 p-4 sm:p-6"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="m-auto w-full max-w-2xl rounded-3xl border shadow-2xl"
        style={{
          background: 'var(--color-card-bg)',
          borderColor: 'var(--color-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          <h2
            className="text-base font-bold"
            style={{ color: 'var(--color-text-main)' }}
          >
            {t.room.txTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.room.close}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface)]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div className="space-y-1.5">
            <p
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t.room.txFrom}
            </p>
            <AccountPicker value={account} onChange={setAccount} />
          </div>

          {account && (
            <TransactionBuilder
              key={account}
              accountAddress={account}
              t={fullDictionary}
              locale={language}
              initialDestinationAddress={peerAccount}
              disableCache
              onTransactionSent={handleSent}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
