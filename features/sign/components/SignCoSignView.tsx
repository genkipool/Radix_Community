'use client';

import type { ReactNode } from 'react';
import { Download, FileSignature, TriangleAlert } from 'lucide-react';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import type { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import type { useSealSetup } from '../hooks/useSealRequest';
import type { SignDictionary } from '../types/dictionary';
import type { AttestationEnvelope } from '../types/sign.types';
import { SealOnboarding } from './SealOnboarding';
import { SignErrorText } from './SignErrorText';
import { SignerProgress } from './SignResultPanel';

export function SignCoSignView({
  t,
  consoleT,
  cosignBox,
  loadedCert,
  hashMismatch,
  failure,
  watermarkBox,
  padesBox,
  coSignComplete,
  onDownloadSigned,
  showOnboarding,
  cosignAccount,
  cosignSetup,
  hasCosignRequest,
  canCoSign,
  busy,
  onCoSign,
  onSimulateCoSign,
  canSimulate,
  preview,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  cosignBox: ReactNode;
  loadedCert: AttestationEnvelope;
  hashMismatch: boolean;
  failure: string | null;
  watermarkBox: ReactNode;
  padesBox: ReactNode;
  coSignComplete: boolean;
  onDownloadSigned: () => void;
  showOnboarding: boolean;
  cosignAccount: string | null;
  cosignSetup: ReturnType<typeof useSealSetup>;
  hasCosignRequest: boolean;
  canCoSign: boolean;
  busy: boolean;
  onCoSign: () => void;
  onSimulateCoSign: () => void;
  canSimulate: boolean;
  preview: ReturnType<typeof useTransactionPreview>;
}) {
  return (
    <>
      {cosignBox}
      <SignerProgress t={t} envelope={loadedCert} />
      {hashMismatch && (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-danger, #dc2626)',
            color: 'var(--color-danger, #dc2626)',
          }}
        >
          {t.cosign.fileMismatch}
        </p>
      )}
      {failure && (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-danger, #dc2626)',
            color: 'var(--color-danger, #dc2626)',
          }}
        >
          <SignErrorText t={t} code={failure} />
        </p>
      )}
      {watermarkBox}
      {padesBox}
      {coSignComplete ? (
        <button
          type="button"
          onClick={onDownloadSigned}
          className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow-md transition-all hover:opacity-90 active:scale-95"
        >
          <Download className="size-4" />
          {t.actions.downloadSigned}
        </button>
      ) : (
        <>
          {showOnboarding && cosignAccount && (
            <>
              <div
                className="space-y-2 rounded-xl border px-4 py-3"
                style={{
                  borderColor: 'var(--color-warning, #b45309)',
                  background: 'var(--color-surface)',
                }}
              >
                <p
                  className="flex items-center gap-2 text-sm font-bold"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  <TriangleAlert
                    className="size-4 shrink-0"
                    style={{ color: 'var(--color-warning, #b45309)' }}
                  />
                  {t.cosign.needsCollectionTitle}
                </p>
                {t.cosign.needsCollection.split('{account}').map((part, i) => (
                  <span key={i}>
                    {i > 0 && (
                      <span
                        className="mb-1 block font-mono text-[11px] break-all"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {cosignAccount}
                      </span>
                    )}
                    <span
                      className="block text-sm leading-relaxed"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {part.trim()}
                    </span>
                  </span>
                ))}
              </div>
              <SealOnboarding
                t={t}
                account={cosignAccount}
                onAccountChange={() => {}}
                setup={cosignSetup}
                lockedAccount
                consoleT={consoleT}
              />
            </>
          )}
          <div
            className={
              hasCosignRequest ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''
            }
          >
            <button
              type="button"
              disabled={!canCoSign}
              onClick={onCoSign}
              className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {busy ? (
                <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <FileSignature className="size-4" />
              )}
              {busy ? t.actions.signing : t.cosign.addSignature}
            </button>
            {hasCosignRequest && (
              <SimulateButton
                t={consoleT.simulate}
                onClick={onSimulateCoSign}
                disabled={!canSimulate}
                loading={preview.isSimulating}
              />
            )}
          </div>
          {hasCosignRequest && (
            <SimulateResultCard
              t={consoleT.simulate}
              preview={preview.preview}
              error={preview.error}
              onClose={preview.reset}
            />
          )}
        </>
      )}
    </>
  );
}
