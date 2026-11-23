'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ExternalLink, Loader2, X } from 'lucide-react';

import { useLanguage } from '@/context/LanguageContext';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { truncateAddress } from '@/utils/formatters';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import type { ConsoleTxResult } from '../../types/console.types';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { CollapsibleManifest } from './CollapsibleManifest';
import { SimulateResultCard } from './SimulatePanel';
import { TxActions } from './TxActions';

export interface BatchItem {
  manifest: string;
  /** Recipients in this batch, for the row label. */
  count: number;
  /** The send button's text, when it does more than send a batch (e.g. "Create locker and send"). */
  sendLabel?: string;
}

type BatchStatus = { state: 'sent'; hash: string } | { state: 'failed'; error: string };

interface BatchRunnerProps {
  t: ConsoleDictionary;
  batches: BatchItem[];
  /** Changes whenever the batches are rebuilt, so old statuses never stick to new content. */
  resetKey: string;
  /** With no batches yet, what is missing; the send / simulate buttons show, disabled, above it. */
  blockedReason?: string;
  /** A line under the buttons when there is something to send (e.g. batches still to come). */
  note?: string;
  /** What the send button says while there is one transaction or none (say what it does, not just "send"). */
  sendLabel?: string;
  /** A third action, first in the button row while there is one transaction or none. */
  leading?: ReactNode;
  /** Called when a batch commits, with what the wallet returned. */
  onSent?: (index: number, result: ConsoleTxResult) => void;
  /** Optional confirmation modal shown before sending (e.g. risky irreversible actions). */
  confirmBeforeSend?: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
  };
}

/**
 * Runs a list of transactions one by one: each row can be simulated, then
 * sent to the wallet. The wallet shows one request at a time, so only one
 * batch is in flight; a sent batch is marked with its transaction and cannot
 * be sent twice by accident.
 */
export function BatchRunner({ t, batches, resetKey, blockedReason, note, sendLabel, leading, onSent, confirmBeforeSend }: BatchRunnerProps) {
  const labels = t.batches;
  const { language } = useLanguage();
  const { activeNetwork } = useRadixWallet();
  const { sendTransaction, isSending, error } = useConsoleTransaction();
  const preview = useTransactionPreview();
  const [statuses, setStatuses] = useState<Record<string, BatchStatus>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [previewed, setPreviewed] = useState<number | null>(null);
  const [pendingConfirmIndex, setPendingConfirmIndex] = useState<number | null>(null);

  const keyOf = (i: number) => `${resetKey}:${i}`;
  const sentCount = batches.filter((_, i) => statuses[keyOf(i)]?.state === 'sent').length;
  const errorMessages = t.common.errors as Record<string, string>;
  const translatedError = error ? (errorMessages[error] ?? error) : null;

  const executeSend = async (i: number) => {
    setBusy(i);
    const result = await sendTransaction(batches[i].manifest);
    setStatuses((prev) => ({
      ...prev,
      [keyOf(i)]: result
        ? { state: 'sent', hash: result.transactionIntentHash }
        : // The hook's error lands in state after this render; it is shown below the list.
          { state: 'failed', error: labels.failed },
    }));
    setBusy(null);
    if (result) onSent?.(i, result);
  };

  const send = (i: number) => {
    if (confirmBeforeSend) {
      setPendingConfirmIndex(i);
      return;
    }
    void executeSend(i);
  };

  const confirmModal = pendingConfirmIndex !== null && confirmBeforeSend ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => setPendingConfirmIndex(null)}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl"
        style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className="size-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--color-danger) 14%, transparent)', color: 'var(--color-danger)' }}
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="space-y-1.5 min-w-0">
            <h3 className="text-sm font-black" style={{ color: 'var(--color-text-main)' }}>
              {confirmBeforeSend.title}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {confirmBeforeSend.message}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => setPendingConfirmIndex(null)}
            className="px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer hover:opacity-80"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
          >
            {confirmBeforeSend.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              const idx = pendingConfirmIndex;
              setPendingConfirmIndex(null);
              void executeSend(idx);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer hover:opacity-90"
            style={{ background: 'var(--color-danger)' }}
          >
            {confirmBeforeSend.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const simulate = (i: number) => {
    setPreviewed(i);
    void preview.simulate(batches[i].manifest);
  };

  // Nothing to send yet: the buttons are still there, off, so it is clear what the page ends with.
  // One transaction: the same two buttons as every other form, not a list of one.
  if (batches.length === 1) {
    const status = statuses[keyOf(0)];
    return (
      <div className="space-y-4">
        <CollapsibleManifest manifest={batches[0].manifest} showLabel={labels.showManifest} hideLabel={labels.hideManifest} copyLabel={t.common.copy} />
        <TxActions
          t={t}
          onSend={() => send(0)}
          onSimulate={() => simulate(0)}
          sendDisabled={isSending || status?.state === 'sent'}
          simulateDisabled={isSending || preview.isSimulating}
          sending={busy === 0}
          simulating={preview.isSimulating}
          sendLabel={status?.state === 'sent' ? labels.sent : (batches[0].sendLabel ?? sendLabel ?? labels.send)}
          sendingLabel={t.common.sending}
          blockedReason={note}
          leading={leading}
        />
        {status?.state === 'sent' && (
          <a
            href={dashboardRoutes.tx(language, status.hash, { network: activeNetwork })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--color-success)' }}
          >
            <Check className="size-3.5" />
            {truncateAddress(status.hash, 10, 6)}
            <ExternalLink className="size-3" />
          </a>
        )}
        <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
        {translatedError && !isSending && (
          <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>
            {labels.lastError.replace('{error}', translatedError)}
          </p>
        )}
        {confirmModal}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="space-y-4">
        <CollapsibleManifest manifest="" showLabel={labels.showManifest} hideLabel={labels.hideManifest} copyLabel={t.common.copy} />
        <TxActions
          t={t}
          onSend={() => {}}
          onSimulate={() => {}}
          sendDisabled
          simulateDisabled
          sendLabel={sendLabel ?? labels.send}
          sendingLabel={t.common.sending}
          blockedReason={blockedReason}
          leading={leading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {note && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {note}
        </p>
      )}
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {labels.progress.replace('{sent}', String(sentCount)).replace('{total}', String(batches.length))}
      </p>
      <ol className="space-y-2">
        {batches.map((batch, i) => {
          const status = statuses[keyOf(i)];
          return (
            <li
              key={keyOf(i)}
              className="space-y-2 rounded-xl border p-3"
              style={{ borderColor: 'var(--color-card-border)', background: 'var(--color-surface)' }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                  {labels.batch.replace('{n}', String(i + 1)).replace('{count}', String(batch.count))}
                </span>
                {status?.state === 'sent' && (
                  <a
                    href={dashboardRoutes.tx(language, status.hash, { network: activeNetwork })}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold"
                    style={{ color: 'var(--color-success)' }}
                  >
                    <Check className="size-3.5" />
                    {truncateAddress(status.hash, 10, 6)}
                    <ExternalLink className="size-3" />
                  </a>
                )}
                {status?.state === 'failed' && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                    <X className="size-3.5" />
                    {status.error}
                  </span>
                )}
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => simulate(i)}
                    disabled={isSending || preview.isSimulating}
                    className="h-8 rounded-lg border px-3 text-xs font-bold cursor-pointer hover:opacity-80 disabled:opacity-40"
                    style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-main)' }}
                  >
                    {labels.simulate}
                  </button>
                  <button
                    type="button"
                    onClick={() => send(i)}
                    disabled={isSending || status?.state === 'sent'}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy === i && <Loader2 className="size-3.5 animate-spin" />}
                    {status?.state === 'sent' ? labels.sent : labels.send}
                  </button>
                </span>
              </div>
              <CollapsibleManifest
                manifest={batch.manifest}
                showLabel={labels.showManifest}
                hideLabel={labels.hideManifest}
                copyLabel={t.common.copy}
              />
              {previewed === i && (
                <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
              )}
            </li>
          );
        })}
      </ol>
      {translatedError && !isSending && (
        <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>
          {labels.lastError.replace('{error}', translatedError)}
        </p>
      )}
      {confirmModal}
    </div>
  );
}
