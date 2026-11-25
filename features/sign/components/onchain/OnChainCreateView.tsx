'use client';

import { FileSignature, Send } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import type { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import type { SignDictionary } from '../../types/dictionary';
import { SignErrorText } from '../SignErrorText';
import {
  OnChainDanger,
  OnChainManualKey,
  OnChainMuted,
  type InviteMode,
} from './OnChainPrimitives';

export function OnChainCreateView({
  t,
  consoleT,
  solo,
  inviteMode,
  onInviteModeChange,
  alsoSign,
  docHash,
  cleanSignersCount,
  invalidSigner,
  errorCode,
  busy,
  canCreate,
  onCreate,
  onSimulate,
  preview,
  keyInput,
  onKeyInputChange,
  onLoadKey,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  solo: boolean;
  inviteMode: InviteMode;
  onInviteModeChange: (mode: InviteMode) => void;
  alsoSign: boolean;
  docHash: string;
  cleanSignersCount: number;
  invalidSigner: string | undefined;
  errorCode: string | null;
  busy: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onSimulate: () => void;
  preview: ReturnType<typeof useTransactionPreview>;
  keyInput: string;
  onKeyInputChange: (v: string) => void;
  onLoadKey: () => void;
}) {
  return (
    <div className="space-y-4">
      <ToolSection
        title={solo ? t.onchain.soloTitle : t.onchain.requestTitle}
        hint={solo ? t.onchain.soloHint : t.onchain.requestHint}
      >
        {!solo && (
          <OptionButtons<InviteMode>
            value={inviteMode}
            onChange={onInviteModeChange}
            disabled={busy}
            layout="grid"
            className="grid-cols-1 sm:grid-cols-2"
            options={[
              {
                value: 'sign',
                label: t.onchain.inviteSign,
                description: t.onchain.inviteSignDesc,
              },
              {
                value: 'send',
                label: t.onchain.inviteSend,
                description: t.onchain.inviteSendDesc,
              },
            ]}
          />
        )}
        {!docHash && <OnChainMuted text={t.onchain.needFile} />}
        {!solo && docHash && cleanSignersCount === 0 && (
          <OnChainMuted text={t.onchain.needSigners} />
        )}
        {invalidSigner && (
          <OnChainDanger text={`${t.onchain.invalidSigner}: ${invalidSigner}`} />
        )}
        {errorCode && (
          <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
            <SignErrorText t={t} code={errorCode} />
          </p>
        )}
        {!solo && (
          <p
            className="text-xs"
            style={{ color: 'var(--color-warning, #b45309)' }}
          >
            ⚠ {t.onchain.depositWarning}
          </p>
        )}
      </ToolSection>

      {/* Action buttons render at the panel's bottom level (outside the box)
          so they match the off-ledger layout. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={!canCreate}
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {busy ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : alsoSign ? (
            <FileSignature className="size-4" />
          ) : (
            <Send className="size-4" />
          )}
          {busy
            ? t.onchain.creating
            : alsoSign
              ? t.actions.sign
              : t.onchain.sendInvites}
        </button>
        <SimulateButton
          t={consoleT.simulate}
          onClick={onSimulate}
          disabled={!canCreate}
          loading={preview.isSimulating}
        />
      </div>
      <SimulateResultCard
        t={consoleT.simulate}
        preview={preview.preview}
        error={preview.error}
        onClose={preview.reset}
      />

      <OnChainManualKey
        t={t}
        value={keyInput}
        onChange={onKeyInputChange}
        onLoad={onLoadKey}
        busy={busy}
      />
    </div>
  );
}
