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
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';
import { ToolSection } from '../shared/ToolSection';
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
 * Full width, one column, one box per zone — the same shape as the staking
 * tool. The manifest sits under the form as a disclosure rather than a
 * permanent side column: it is there to be read before signing, not to be
 * watched, and giving it half the page squeezed the form it describes.
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

        <CollapsibleManifest
          manifest={manifest}
          showLabel={labels.showManifest}
          hideLabel={labels.hideManifest}
          copyLabel={common.copy}
        />

        <div className="flex flex-wrap items-center gap-3">
          <SendToWalletButton
            onClick={() => sendTransaction(manifest)}
            disabled={!ready || isSending}
            loading={isSending}
            label={common.sendToWallet}
            loadingLabel={common.sending}
          />
          <SimulateButton
            t={t.simulate}
            onClick={() => preview.simulate(manifest)}
            disabled={!manifest.trim() || isSending}
            loading={preview.isSimulating}
          />
        </div>

        {blockedReason && (
          <p className="text-xs leading-relaxed" style={{ color: 'rgb(244,63,94)' }}>
            {blockedReason}
          </p>
        )}
      </ToolSection>

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
