'use client';

import type { ReactNode } from 'react';

import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import type { ValidatorFormContext } from '../../hooks/useValidatorFormContext';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import {
  buildValidatorBatchManifest,
  type ValidatorOperation,
} from '../../lib/validator-operations';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { CollapsibleManifest } from '../shared/CollapsibleManifest';
import { SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
import { TxActions } from '../shared/TxActions';
import { TxResultBanner } from '../shared/TxResultBanner';
import { ValidatorContextPanel } from './ValidatorContextPanel';

interface ValidatorFormShellProps {
  t: ConsoleDictionary;
  ctx: ValidatorFormContext;
  /** What the form currently amounts to; everything goes in one transaction. */
  operations: ValidatorOperation[];
  /** Section heading for the form itself. */
  title: string;
  hint?: string;
  children: ReactNode;
  /** Set on the creation form, which acts before any validator exists. */
  withoutValidator?: boolean;
  /** Blocks sending with this message, for rules the form cannot prevent. */
  blockedReason?: string;
}

/**
 * The frame every validator form sits in: the shared account/validator
 * context, the form, and one transaction built out of it.
 *
 * Full width, one column, one box per zone, the same shape as the pool tools:
 * the manifest and the send / simulate buttons sit under the form's box, not
 * inside it. The manifest is a disclosure rather than a permanent side
 * column: it is there to be read before signing, not to be watched.
 *
 * Each form covers exactly one set of operations the engine lets share a
 * transaction, so the shell never has to warn about combinations: what the
 * form can express is already legal.
 */
export function ValidatorFormShell({
  t,
  ctx,
  operations,
  title,
  hint,
  children,
  withoutValidator,
  blockedReason,
}: ValidatorFormShellProps) {
  const labels = t.validator;
  const common = t.common;
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  const manifest = ctx.account ? buildValidatorBatchManifest(operations, ctx.batchContext) : '';
  const ready = !!manifest.trim() && !blockedReason;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.contextTitle}>
        <ValidatorContextPanel t={t} ctx={ctx} hideValidator={withoutValidator} disabled={isSending} />
      </ToolSection>

      <ToolSection title={title} hint={hint}>
        {ctx.account ? (
          children
        ) : (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.pickAccountFirst}
          </p>
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
        onSend={() => sendTransaction(manifest)}
        onSimulate={() => preview.simulate(manifest)}
        sendDisabled={!ready || isSending}
        simulateDisabled={!manifest.trim() || isSending}
        sending={isSending}
        simulating={preview.isSimulating}
        sendLabel={common.sendToWallet}
        sendingLabel={common.sending}
        blockedReason={blockedReason}
        reasonTone="error"
      />

      <SimulateResultCard
        t={t.simulate}
        preview={preview.preview}
        error={preview.error}
        onClose={preview.reset}
      />
      <TxResultBanner
        t={common}
        result={result}
        error={error}
        onReset={reset}
        preview={preview.preview}
      />
    </div>
  );
}
