'use client';

import { BadgeCheck, Circle, Send, Stamp } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import type { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { NETWORKS } from '@/features/wallet/constants/network';
import type { useSealSetup } from '../../hooks/useSealRequest';
import type { OnChainStatus } from '../../services/signApi';
import type { SignDictionary } from '../../types/dictionary';
import { SignCollectionSwitch } from '../SignCollectionSwitch';
import { SignErrorText } from '../SignErrorText';
import { OnChainDanger, OnChainMuted } from './OnChainPrimitives';

export function OnChainCoSignSection({
  t,
  consoleT,
  status,
  hasStatusData,
  statusError,
  loading,
  notFound,
  wrongNetwork,
  requestNetworkId,
  eligible,
  alreadySigned,
  docHash,
  hashMismatch,
  actingAccount,
  setup,
  sealDeployed,
  busy,
  phase,
  errorCode,
  canSign,
  onMintSeal,
  onSign,
  onSimulate,
  preview,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  status: OnChainStatus | null;
  hasStatusData: boolean;
  statusError: boolean;
  loading: boolean;
  notFound: boolean;
  wrongNetwork: boolean;
  requestNetworkId: number | null;
  eligible: boolean;
  alreadySigned: boolean;
  docHash: string;
  hashMismatch: boolean;
  actingAccount: string | null;
  setup: ReturnType<typeof useSealSetup>;
  sealDeployed: boolean;
  busy: boolean;
  phase: string;
  errorCode: string | null;
  canSign: boolean;
  onMintSeal: () => void;
  onSign: () => void;
  onSimulate: () => void;
  preview: ReturnType<typeof useTransactionPreview>;
}) {
  return (
    <ToolSection title={t.onchain.signSectionTitle}>
      {loading && !hasStatusData ? (
        <OnChainMuted text={t.onchain.checkingEligibility} />
      ) : statusError ? (
        <OnChainDanger text={t.onchain.statusError} />
      ) : notFound ? (
        <OnChainMuted text={t.onchain.notFound} />
      ) : wrongNetwork ? (
        <OnChainDanger
          text={t.onchain.wrongNetwork.replace(
            /\{network\}/g,
            NETWORKS[requestNetworkId!]?.networkName ?? '',
          )}
        />
      ) : status && !eligible ? (
        <>
          <OnChainDanger text={t.onchain.notEligible} />
          <OnChainMuted text={t.onchain.notEligibleHint} />
        </>
      ) : alreadySigned ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-success)]">
          <BadgeCheck className="size-4 shrink-0" />
          {t.onchain.alreadySigned}
        </p>
      ) : status ? (
        <>
          <p
            className="flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <BadgeCheck className="size-3.5 shrink-0 text-[var(--color-success)]" />
            {t.onchain.inviteInWallet}
          </p>
          {!setup.seal && setup.ready && (
            <div
              className="rounded-xl border p-3.5 space-y-2"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-card-border)',
              }}
            >
              <p
                className="flex items-center gap-2 text-xs font-bold"
                style={{ color: 'var(--color-text-main)' }}
              >
                <Circle
                  className="size-4 shrink-0"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                {t.onchain.sealStep}
              </p>
              <div className="space-y-2 pl-6">
                {!sealDeployed ? (
                  <OnChainMuted text={t.onchain.sealNotDeployed} />
                ) : (
                  <>
                    <OnChainMuted text={t.onchain.sealMissing} />
                    <button
                      type="button"
                      disabled={busy || !actingAccount}
                      onClick={onMintSeal}
                      className="flex items-center gap-2 px-4 h-9 rounded-full font-bold text-xs text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                    >
                      {phase === 'minting-seal' ? (
                        <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      ) : (
                        <Stamp className="size-3.5" />
                      )}
                      {phase === 'minting-seal'
                        ? t.onchain.sealMinting
                        : t.onchain.sealGet}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {setup.seal && !setup.collection && (
            <OnChainMuted text={t.onchain.firstSignNote} />
          )}
          <SignCollectionSwitch t={t} account={actingAccount} setup={setup} />
          {errorCode && (
            <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
              <SignErrorText t={t} code={errorCode} />
            </p>
          )}
        </>
      ) : null}
      {!alreadySigned && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!canSign}
              onClick={onSign}
              className="flex w-full items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {phase === 'signing' || phase === 'creating-collection' ? (
                <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {phase === 'signing' || phase === 'creating-collection'
                ? t.onchain.signing
                : t.onchain.sign}
            </button>
            <SimulateButton
              t={consoleT.simulate}
              onClick={onSimulate}
              disabled={!canSign}
              loading={preview.isSimulating}
            />
          </div>
          {status && !!docHash && hashMismatch && (
            <OnChainDanger text={t.onchain.fileMismatch} />
          )}
          {status && !docHash && <OnChainMuted text={t.onchain.needFile} />}
          <SimulateResultCard
            t={consoleT.simulate}
            preview={preview.preview}
            error={preview.error}
            onClose={preview.reset}
          />
        </>
      )}
    </ToolSection>
  );
}
