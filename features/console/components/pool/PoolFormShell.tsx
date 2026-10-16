'use client';

import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import type { PoolFormContext } from '../../hooks/usePoolFormContext';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import type { ConsoleTxResult } from '../../types/console.types';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
import { TxActions } from '../shared/TxActions';
import { TxResultBanner } from '../shared/TxResultBanner';
import { PoolContextPanel } from './PoolContextPanel';

interface PoolFormShellProps {
  t: ConsoleDictionary;
  ctx: PoolFormContext;
  /** The transaction the form currently amounts to ('' while incomplete). */
  manifest: string;
  title: string;
  hint?: string;
  children: ReactNode;
  /** Set on the creation form, which acts before the pool exists. */
  withoutPool?: boolean;
  /** Blocks sending with this message, for rules the form cannot prevent. */
  blockedReason?: string;
  createdEntityLabel?: string;
  /** What the send button says: the action, not just "send" (e.g. "Create pool"). */
  sendLabel?: string;
  /** Shown under the result once the transaction commits (e.g. the next step). */
  afterResult?: (result: ConsoleTxResult) => ReactNode;
}

/**
 * The frame every pool form sits in, the same shape as the validator section:
 * the shared account/pool context, the form, and one transaction built out of
 * it, with the manifest and the buttons under the form box, as in Create token.
 */
export function PoolFormShell({
  t,
  ctx,
  manifest,
  title,
  hint,
  children,
  withoutPool,
  blockedReason,
  createdEntityLabel,
  sendLabel,
  afterResult,
}: PoolFormShellProps) {
  const labels = t.pool;
  const common = t.common;
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const queryClient = useQueryClient();
  /** Sends, and once it commits reloads the pool and the account so the panel shows the new reserves and units. */
  const send = async () => {
    if (await sendTransaction(manifest)) {
      for (const key of ['console-pool-state', 'console-pool-unit-supply', 'console-account-resources', 'console-pool-profile', 'console-pool-profile-current']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
  };
  const preview = useTransactionPreview();

  const ready = !!manifest.trim() && !blockedReason;
  const needsPool = !withoutPool && !ctx.state;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.contextTitle}>
        <PoolContextPanel t={t} ctx={ctx} hidePool={withoutPool} disabled={isSending} />
      </ToolSection>

      <ToolSection title={title} hint={hint}>
        {!ctx.account ? (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.pickAccountFirst}
          </p>
        ) : needsPool ? (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.pickPoolFirst}
          </p>
        ) : (
          children
        )}
      </ToolSection>

      <CollapsibleManifest
        manifest={manifest}
        showLabel={labels.showManifest}
        hideLabel={labels.hideManifest}
        copyLabel={common.copy}
      />

      <TxActions
        t={t}
        onSend={send}
        onSimulate={() => preview.simulate(manifest)}
        sendDisabled={!ready || isSending}
        simulateDisabled={!manifest.trim() || isSending}
        sending={isSending}
        simulating={preview.isSimulating}
        sendLabel={sendLabel ?? common.sendToWallet}
        sendingLabel={common.sending}
        blockedReason={blockedReason}
        reasonTone="error"
      />

      <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
      <TxResultBanner
        t={common}
        result={result}
        error={error}
        onReset={reset}
        preview={preview.preview}
        createdEntityLabel={createdEntityLabel}
      />
      {result && afterResult?.(result)}
    </div>
  );
}
