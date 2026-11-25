'use client';

import { useState } from 'react';
import { FileSignature } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useCoSignDrop } from '../hooks/useCoSignDrop';
import type { DocumentFile } from '../hooks/useDocumentFile';
import { useDocumentSign } from '../hooks/useDocumentSign';
import { usePadesCertificate } from '../hooks/usePadesCertificate';
import { useSealRequest, type useSealSetup } from '../hooks/useSealRequest';
import { useSignFormSubmit } from '../hooks/useSignFormSubmit';
import type { WatermarkKind, WatermarkOptions } from '../lib/pdf-watermark';
import type { SharedWatermark } from '../lib/share';
import type { SignDictionary } from '../types/dictionary';
import type {
  DisclosurePolicy,
  OutputFormat,
  SignResult,
} from '../types/sign.types';
import { OnChainSignPanel } from './OnChainSignPanel';
import { PadesSignSection } from './PadesSignSection';
import { SealOnboarding } from './SealOnboarding';
import { SignCoSignView } from './SignCoSignView';
import {
  MultiModeSection,
  OutputFormatSection,
  WatermarkSection,
} from './SignDeliverySections';
import { SignErrorText } from './SignErrorText';
import { SignMessageIdentitySection } from './SignMessageIdentitySection';
import { ResultPanel } from './SignResultPanel';

export { ResultPanel };

/**
 * Full document signing & co-signing form orchestrating off-chain ROLA,
 * on-ledger Radix Seal, PAdES X.509 signing, watermarks, and dry-run previews.
 */
export function SignForm({
  t,
  consoleT,
  doc,
  sharedRequestKey,
  sharedOutputs,
  sharedWatermark,
  onchainAccount,
  onOnchainAccountChange,
  onchain,
  onOnchainChange,
  setup,
  needsOnboarding,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  doc: DocumentFile;
  sharedRequestKey?: string;
  sharedOutputs?: OutputFormat[];
  sharedWatermark?: SharedWatermark;
  onchainAccount: string | null;
  onOnchainAccountChange: (account: string) => void;
  onchain: boolean;
  onOnchainChange: (value: boolean) => void;
  setup: ReturnType<typeof useSealSetup>;
  needsOnboarding: boolean;
}) {
  const { file, bytes, docHash, hashing, pdf: pdfOk } = doc;

  const [message, setMessage] = useState('');
  const [disclosure, setDisclosure] = useState<DisclosurePolicy>('none');
  const [includeEmail, setIncludeEmail] = useState(false);
  const [outputs, setOutputs] = useState<OutputFormat[]>(
    sharedOutputs && sharedOutputs.length > 0 ? sharedOutputs : ['detached'],
  );
  const [outputsPicked, setOutputsPicked] = useState(
    !!sharedOutputs && sharedOutputs.length > 0,
  );
  const effectiveOutputs: OutputFormat[] =
    !outputsPicked && pdfOk
      ? [...new Set([...outputs, 'embedded' as const])]
      : outputs;

  const [watermark, setWatermark] = useState<WatermarkKind>(
    sharedWatermark?.kind ?? 'none',
  );
  const [watermarkText, setWatermarkText] = useState(sharedWatermark?.text ?? '');
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const [watermarkImageFile, setWatermarkImageFile] = useState<File | null>(null);

  const sharedRequestId = sharedRequestKey ?? doc.embeddedRequest?.requestKey;
  const [multi, setMulti] = useState(!!sharedRequestKey);
  const [coSigners, setCoSigners] = useState<string[]>(['']);
  const [inviteMode, setInviteMode] = useState<'sign' | 'send'>('sign');
  const [result, setResult] = useState<SignResult | null>(null);
  const [setupError, setSetupError] = useState('');

  const {
    pades,
    setPades,
    padesError,
    setPadesError,
    padesStatus,
    padesChecking,
    padesCert,
    padesActive,
    padesBlocking,
  } = usePadesCertificate(pdfOk);

  const { sign, coSign, phase, error, reset } = useDocumentSign();
  const {
    createRequest,
    signRequest,
    phase: ledgerPhase,
    error: ledgerError,
  } = useSealRequest();
  const invitePreview = useTransactionPreview();

  const coSignDrop = useCoSignDrop({
    t,
    bytes,
    docHash,
    onResetSign: () => {
      setResult(null);
      reset();
    },
  });

  const ledgerBusy =
    ledgerPhase !== 'idle' && ledgerPhase !== 'done' && ledgerPhase !== 'error';
  const busy = phase === 'signing' || phase === 'anchoring' || ledgerBusy;
  const watermarkOptions: WatermarkOptions = coSignDrop.inheritedWatermark ?? {
    kind: watermark,
    text: watermarkText,
    imageUrl: watermark === 'own' ? (watermarkImage ?? undefined) : undefined,
  };
  const forcedOnchain = !!doc.embeddedRequest;
  const onchainMode = onchain || forcedOnchain;
  const multiLedger = multi && onchainMode && !forcedOnchain;

  const {
    handleSign,
    handleCoSign,
    downloadSignedDoc,
    onSimulateInvite,
    onSimulateSign,
    onSimulateCoSign,
  } = useSignFormSubmit({
    t,
    file,
    bytes,
    docHash,
    message,
    disclosure,
    includeEmail,
    multi,
    coSigners,
    onchainMode,
    multiLedger,
    inviteMode,
    onchainAccount,
    setup,
    effectiveOutputs,
    watermarkOptions,
    pades,
    padesCert,
    padesActive,
    setPadesError,
    setResult,
    setSetupError,
    setBlockedAccount: coSignDrop.setBlockedAccount,
    loadedCert: coSignDrop.loadedCert,
    coSignBytes: coSignDrop.coSignBytes,
    cosignRequest: coSignDrop.cosignRequest,
    cosignAccount: coSignDrop.cosignAccount,
    cosignSetup: coSignDrop.cosignSetup,
    cosignNeedsSetup: coSignDrop.cosignNeedsSetup,
    sign,
    coSign,
    createRequest,
    signRequest,
    invitePreview,
  });

  const onWatermarkImage = (picked: File | null) => {
    setWatermarkImageFile(picked);
    if (!picked) {
      setWatermarkImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setWatermarkImage(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(picked);
  };

  const startOver = () => {
    setResult(null);
    doc.onFile(null);
    setMessage('');
    coSignDrop.resetCert();
    reset();
  };

  if (result) {
    return (
      <ResultPanel
        t={t}
        consoleT={consoleT}
        result={result}
        outputs={effectiveOutputs}
        onReset={startOver}
        pades={padesActive ? pades : null}
        watermark={watermarkOptions}
        padesError={padesError}
        onPadesError={setPadesError}
      />
    );
  }

  const failure = error ?? ledgerError ?? (setupError || null);
  const hashMismatch =
    coSignDrop.coSignMode &&
    !!coSignDrop.coSignHash &&
    coSignDrop.coSignHash !== coSignDrop.loadedCert!.payload.docHash;

  if (needsOnboarding && !sharedRequestId) {
    return (
      <div className="space-y-5">
        <SealOnboarding
          t={t}
          account={onchainAccount}
          onAccountChange={onOnchainAccountChange}
          setup={setup}
          consoleT={consoleT}
          lockedAccount
        />
      </div>
    );
  }

  const cosignBox = (
    <ToolSection title={t.cosign.title} hint={t.cosign.hint}>
      <FileDropzone
        extension=".json"
        label={t.cosign.certLabel}
        prompt={t.cosign.certPrompt}
        file={coSignDrop.certFile}
        onFile={coSignDrop.onCert}
        error={coSignDrop.certError}
        disabled={busy}
      />
    </ToolSection>
  );

  const outputBox = (
    <OutputFormatSection
      t={t}
      outputs={effectiveOutputs}
      pdfOk={pdfOk}
      busy={busy}
      onChange={(v) => {
        if (v.length === 0) return;
        setOutputsPicked(true);
        setOutputs(v);
      }}
    />
  );

  const watermarkBox = pdfOk && !coSignDrop.inheritedWatermark && (
    <WatermarkSection
      t={t}
      watermark={watermark}
      onWatermarkChange={setWatermark}
      watermarkText={watermarkText}
      onWatermarkTextChange={setWatermarkText}
      watermarkImageFile={watermarkImageFile}
      onWatermarkImage={onWatermarkImage}
      busy={busy}
    />
  );

  const padesBox = pdfOk && (
    <PadesSignSection
      t={t}
      config={pades}
      onChange={setPades}
      disabled={busy}
      status={padesStatus}
      checking={padesChecking}
      error={padesError}
    />
  );

  return (
    <div className="space-y-5">
      {coSignDrop.coSignMode ? (
        <SignCoSignView
          t={t}
          consoleT={consoleT}
          cosignBox={cosignBox}
          loadedCert={coSignDrop.loadedCert!}
          hashMismatch={hashMismatch}
          failure={failure}
          watermarkBox={watermarkBox}
          padesBox={padesBox}
          coSignComplete={coSignDrop.coSignComplete}
          onDownloadSigned={() => void downloadSignedDoc()}
          showOnboarding={
            coSignDrop.cosignNeedsSetup ||
            (!!coSignDrop.blockedAccount && !!setupError)
          }
          cosignAccount={coSignDrop.cosignAccount}
          cosignSetup={coSignDrop.cosignSetup}
          hasCosignRequest={!!coSignDrop.cosignRequest}
          canCoSign={
            !!coSignDrop.coSignBytes &&
            !hashMismatch &&
            !busy &&
            !padesBlocking &&
            !coSignDrop.cosignNeedsSetup &&
            !(
              !!coSignDrop.cosignRequest &&
              coSignDrop.cosignCandidates.length > 0 &&
              !coSignDrop.cosignEligible.resolved
            )
          }
          busy={busy}
          onCoSign={handleCoSign}
          onSimulateCoSign={onSimulateCoSign}
          canSimulate={
            !busy &&
            !coSignDrop.cosignNeedsSetup &&
            !!coSignDrop.cosignSetup.collection
          }
          preview={invitePreview}
        />
      ) : sharedRequestId ? (
        <>
          {forcedOnchain && (
            <p
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
                background: 'var(--color-surface)',
              }}
            >
              {t.onchain.requestDetected}
            </p>
          )}
          <OnChainSignPanel
            key={sharedRequestId}
            t={t}
            consoleT={consoleT}
            doc={doc}
            requiredSigners={[]}
            initialRequestId={sharedRequestId}
            account={onchainAccount}
            solo={false}
            outputs={effectiveOutputs}
            watermark={watermarkOptions}
          />
        </>
      ) : (
        <>
          {cosignBox}

          <SignMessageIdentitySection
            t={t}
            message={message}
            onMessageChange={setMessage}
            disclosure={disclosure}
            includeEmail={includeEmail}
            onDisclosureChange={({ disclosure: nextD, includeEmail: nextE }) => {
              setDisclosure(nextD);
              setIncludeEmail(nextE);
            }}
            busy={busy}
          />

          {outputBox}
          {watermarkBox}
          {padesBox}

          <MultiModeSection
            t={t}
            multi={multi}
            onMultiChange={setMulti}
            onchainMode={onchainMode}
            onOnchainChange={onOnchainChange}
            coSigners={coSigners}
            onCoSignersChange={setCoSigners}
            multiLedger={multiLedger}
            inviteMode={inviteMode}
            onInviteModeChange={setInviteMode}
            busy={busy}
          />

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

          <div
            className={onchainMode ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}
          >
            <button
              type="button"
              disabled={
                !docHash ||
                hashing ||
                busy ||
                padesBlocking ||
                (multiLedger &&
                  (!setup.seal || !setup.collection || !onchainAccount))
              }
              onClick={handleSign}
              className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {busy ? (
                <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <FileSignature className="size-4" />
              )}
              {busy
                ? t.actions.signing
                : multiLedger && inviteMode === 'send'
                  ? t.onchain.sendInvites
                  : t.actions.sign}
            </button>
            {onchainMode && (
              <SimulateButton
                t={consoleT.simulate}
                onClick={multiLedger ? onSimulateInvite : onSimulateSign}
                disabled={busy}
                loading={invitePreview.isSimulating}
              />
            )}
          </div>
          {onchainMode && (
            <SimulateResultCard
              t={consoleT.simulate}
              preview={invitePreview.preview}
              error={invitePreview.error}
              onClose={invitePreview.reset}
            />
          )}
        </>
      )}
    </div>
  );
}
