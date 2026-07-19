'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileSignature,
  RotateCcw,
  UsersRound,
} from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { StringListField } from '@/features/console/components/shared/StringListField';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useDocumentSign } from '../hooks/useDocumentSign';
import { useSealRequest, useSealSetup } from '../hooks/useSealRequest';
import { findSignCollection, findUserSeal } from '../services/sealDiscovery';
import type { DocumentFile } from '../hooks/useDocumentFile';
import { OnChainSignPanel } from './OnChainSignPanel';
import { SealDeployPanel } from './SealDeployPanel';
import { ShareLinkSection } from './ShareLinkSection';
import { SealOnboarding } from './SealOnboarding';
import { stripExtension } from '../lib/file';
import { downloadBytes, downloadCertificate } from '../lib/certificate';
import { embedCertificateInPdf } from '../lib/pdf-embed';
import {
  applyWatermark,
  type WatermarkKind,
  type WatermarkOptions,
} from '../lib/pdf-watermark';
import {
  buildSignCollectionCreateManifest,
  buildSignRequestManifest,
  buildSignatureMintManifest,
} from '../lib/sign-request';
import { blake2b256Hex, randomNonceHex } from '../lib/hash';
import type { SharedWatermark } from '../lib/share';
import { extractRadixAttachments, isPdfBytes } from '../lib/pdf-extract';
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import { explorerTxUrl } from '../lib/explorer';
import type { SignDictionary } from '../types/dictionary';
import type {
  AttestationEnvelope,
  DisclosurePolicy,
  OutputFormat,
  SignResult,
} from '../types/sign.types';

type IdentityOpt = DisclosurePolicy | 'email';

const isPdfResult = (r: { fileType: string; fileName: string }) =>
  r.fileType === 'application/pdf' || r.fileName.toLowerCase().endsWith('.pdf');

export function looksLikeEnvelope(v: unknown): v is AttestationEnvelope {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  const payload = e.payload as Record<string, unknown> | undefined;
  return (
    typeof payload?.docHash === 'string' &&
    Array.isArray(payload?.signers) &&
    Array.isArray(e.signatures)
  );
}

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
  /** Request key from a shared link (directory or `?req=` format). */
  sharedRequestKey?: string;
  /** Delivery formats the initiator baked into the shared link. */
  sharedOutputs?: OutputFormat[];
  /** Watermark choice the initiator baked into the shared link. */
  sharedWatermark?: SharedWatermark;
  /** Acting on-chain account (lifted to the tool so it can gate the layout). */
  onchainAccount: string | null;
  onOnchainAccountChange: (account: string) => void;
  /** On-chain ("en cadena") toggle, lifted to the tool so the seal/collection
   *  check (and onboarding box) only runs once on-chain is actually selected. */
  onchain: boolean;
  onOnchainChange: (value: boolean) => void;
  setup: ReturnType<typeof useSealSetup>;
  /** True while the seal/collection setup is missing → onboarding-only view. */
  needsOnboarding: boolean;
}) {
  const { file, bytes, docHash, hashing, pdf: pdfOk } = doc;

  const [certFile, setCertFile] = useState<File | null>(null);
  const [loadedCert, setLoadedCert] = useState<AttestationEnvelope | null>(null);
  const [certError, setCertError] = useState('');
  // Bytes to hash/co-sign: the extracted ORIGINAL when a signed PDF is dropped,
  // otherwise the dropped file itself.
  const [coSignBytes, setCoSignBytes] = useState<Uint8Array | null>(null);
  const [coSignHash, setCoSignHash] = useState('');

  const [message, setMessage] = useState('');
  const [disclosure, setDisclosure] = useState<DisclosurePolicy>('none');
  const [includeEmail, setIncludeEmail] = useState(false);
  // A shared link carries the initiator's delivery choices: the co-signer
  // starts from the exact same options.
  const [outputs, setOutputs] = useState<OutputFormat[]>(
    sharedOutputs && sharedOutputs.length > 0 ? sharedOutputs : ['detached'],
  );
  // Watermark for the embedded (signed) PDF. Presentation only: the original is
  // embedded intact, so the document hash is unaffected.
  const [watermark, setWatermark] = useState<WatermarkKind>(
    sharedWatermark?.kind ?? 'none',
  );
  const [watermarkText, setWatermarkText] = useState(sharedWatermark?.text ?? '');
  const [watermarkImage, setWatermarkImage] = useState<string | null>(null);
  const [watermarkImageFile, setWatermarkImageFile] = useState<File | null>(null);
  // A shared link — or a dropped PDF carrying an embedded request pointer —
  // jumps straight into on-chain co-signing.
  const sharedRequestId = sharedRequestKey ?? doc.embeddedRequest?.requestKey;
  const [multi, setMulti] = useState(!!sharedRequestKey);
  const [coSigners, setCoSigners] = useState<string[]>(['']);
  // Multi on-ledger: whether the initiator signs too (ROLA) + issues invitations
  // ('sign'), or only issues invitations without signing ('send').
  const [inviteMode, setInviteMode] = useState<'sign' | 'send'>('sign');
  const [result, setResult] = useState<SignResult | null>(null);

  const { sign, coSign, phase, error, reset } = useDocumentSign();
  const { createRequest, signRequest } = useSealRequest();
  const invitePreview = useTransactionPreview();
  const { activeNetworkId } = useRadixWallet();

  // A dropped signed PDF carries the certificate + original inside, so a
  // co-signer can drop ONE file: we auto-load the certificate and use the
  // extracted original for the hash + signature. Otherwise the dropped file is
  // the document itself.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bytes) {
        if (!cancelled) {
          setCoSignBytes(null);
          setCoSignHash('');
        }
        return;
      }
      if (isPdfBytes(bytes)) {
        const att = await extractRadixAttachments(bytes).catch(() => null);
        if (cancelled) return;
        if (att?.envelope) {
          const original = att.originalBytes ?? bytes;
          setLoadedCert(att.envelope);
          setCertFile(null);
          setCertError('');
          setCoSignBytes(original);
          setCoSignHash(blake2b256Hex(original));
          return;
        }
      }
      if (!cancelled) {
        setCoSignBytes(bytes);
        setCoSignHash(docHash);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, docHash]);

  const busy = phase === 'signing' || phase === 'anchoring';
  const coSignMode = !!loadedCert;
  const watermarkOptions: WatermarkOptions = {
    kind: watermark,
    text: watermarkText,
    imageUrl: watermark === 'own' ? (watermarkImage ?? undefined) : undefined,
  };
  const forcedOnchain = !!doc.embeddedRequest;
  // "On-chain" applies equally to single and multi signing — the only
  // difference downstream is whether the co-signer address list is shown.
  const onchainMode = onchain || forcedOnchain;

  const identityValue: IdentityOpt[] = includeEmail
    ? [disclosure, 'email']
    : [disclosure];
  const onIdentityChange = (v: IdentityOpt[]) => {
    const addedName = v.filter(
      (x) => x !== 'email' && x !== disclosure,
    ) as DisclosurePolicy[];
    if (addedName.length > 0) setDisclosure(addedName[addedName.length - 1]);
    setIncludeEmail(v.includes('email'));
  };

  // The image is read into a data URL and stamped in the browser only; it is
  // never uploaded anywhere.
  const onWatermarkImage = (file: File | null) => {
    setWatermarkImageFile(file);
    if (!file) {
      setWatermarkImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setWatermarkImage(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const onCert = async (picked: File | null) => {
    setCertError('');
    setResult(null);
    reset();
    setCertFile(picked);
    if (!picked) {
      setLoadedCert(null);
      return;
    }
    try {
      const parsed = JSON.parse(await picked.text());
      if (!looksLikeEnvelope(parsed)) {
        setCertError(t.cosign.fileMismatch);
        setLoadedCert(null);
        return;
      }
      setLoadedCert(parsed);
    } catch {
      setCertError(t.cosign.fileMismatch);
      setLoadedCert(null);
    }
  };

  const deliver = async (res: SignResult, chosen: OutputFormat[]) => {
    let delivered = false;
    if (chosen.includes('embedded') && isPdfResult(res)) {
      try {
        // Watermark is a visible layer on the delivered PDF; the ORIGINAL bytes
        // are embedded intact (third arg) so the document hash still matches.
        const visible = await applyWatermark(res.fileBytes, watermarkOptions);
        const pdf = await embedCertificateInPdf(visible, res.envelope, res.fileBytes);
        downloadBytes(
          pdf,
          `${stripExtension(res.fileName)}-signed.pdf`,
          'application/pdf',
        );
        delivered = true;
      } catch {
        // Fall back to the detached certificate below.
      }
    }
    if (chosen.includes('detached') || !delivered) {
      downloadCertificate(res.envelope);
    }
  };

  // Initiator of a multi-party on-ledger signing (not a co-signer arriving via a
  // shared request). The signature is ROLA; the ledger only adds invitations
  // (permission) and the initiator's own record NFT.
  const multiLedger = multi && onchainMode && !forcedOnchain;

  const handleSign = async () => {
    if (!bytes || !docHash || !file || activeNetworkId == null) return;
    const cleanCoSigners = coSigners.map((s) => s.trim()).filter(Boolean);
    // "Solo enviar" (multi ledger): the initiator does NOT sign; they issue the
    // invitations and hand co-signers an empty certificate to fill with ROLA.
    const sendOnly = multiLedger && inviteMode === 'send';

    let finalRes: SignResult;
    if (sendOnly) {
      finalRes = {
        envelope: {
          payload: {
            v: 1,
            docHash,
            hashAlg: 'blake2b-256',
            fileName: file.name,
            fileSize: file.size,
            message: message.trim(),
            disclosure,
            email: includeEmail,
            signers: cleanCoSigners,
            timestamp: new Date().toISOString(),
            networkId: activeNetworkId,
            nonce: randomNonceHex(),
          },
          signatures: [],
          onChain: null,
        },
        fileBytes: bytes,
        fileName: file.name,
        fileType: file.type,
      };
    } else {
      // The signature is ALWAYS the wallet's ROLA proof. Solo on-ledger also
      // mints the record NFT inline. For multi on-ledger the initiator is one of
      // the required signers, so pass their account into the signer set.
      const res = await sign({
        fileBytes: bytes,
        docHash,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        message: message.trim(),
        disclosure,
        includeEmail,
        coSigners: multi ? cleanCoSigners : [],
        signerAccount: multiLedger ? (onchainAccount ?? undefined) : undefined,
        onChain: onchainMode && !multi,
      });
      if (!res) return;
      finalRes = res;
    }

    // On-ledger required signer set: for "sign and send" the initiator is a
    // required signer too (so their signature counts and resolves on-ledger).
    const requestSigners =
      !sendOnly && onchainAccount
        ? [...new Set([onchainAccount, ...cleanCoSigners])]
        : cleanCoSigners;

    // Multi on-ledger: issue the invitation NFTs (permission) and, when the
    // initiator also signs, mint their own record NFT in the same transaction.
    // The request key is stored in the certificate so co-signers know where to
    // mint their records.
    if (multiLedger && setup.seal && setup.collection && onchainAccount) {
      const requestId = await createRequest({
        account: onchainAccount,
        sealGlobalId: setup.seal.globalId,
        collection: setup.collection.resourceAddress,
        nextId: setup.collection.totalSupply + 1,
        docHash,
        requiredSigners: requestSigners,
        alsoSign: !sendOnly,
        imageUrl: sealImageUrl(window.location.origin),
      });
      if (requestId) {
        finalRes = {
          ...finalRes,
          envelope: {
            ...finalRes.envelope,
            request: { networkId: finalRes.envelope.payload.networkId, requestId },
          },
        };
      }
    }

    setResult(finalRes);
    await deliver(finalRes, outputs);
  };

  // Preview the invitation transaction (multi on-ledger).
  const onSimulateInvite = async () => {
    if (!docHash || activeNetworkId == null || !setup.seal || !setup.collection || !onchainAccount)
      return;
    const cleanCoSigners = coSigners.map((s) => s.trim()).filter(Boolean);
    if (cleanCoSigners.length === 0) return;
    invitePreview.simulate(
      buildSignRequestManifest({
        account: onchainAccount,
        sealGlobalId: setup.seal.globalId,
        collection: setup.collection.resourceAddress,
        nextId: setup.collection.totalSupply + 1,
        docHash,
        networkId: activeNetworkId,
        requiredSigners: cleanCoSigners,
        alsoSign: inviteMode === 'sign',
        imageUrl: sealImageUrl(window.location.origin),
      }),
    );
  };

  // Preview the single on-ledger signature: the record NFT minted into the
  // signer's own Seal collection (the SAME manifest handleSign mints inline
  // when on-chain is selected without co-signers).
  const onSimulateSign = () => {
    if (!docHash || activeNetworkId == null || !onchainAccount || !setup.seal || !setup.collection)
      return;
    invitePreview.simulate(
      buildSignatureMintManifest({
        account: onchainAccount,
        sealGlobalId: setup.seal.globalId,
        collection: setup.collection.resourceAddress,
        nextId: setup.collection.totalSupply + 1,
        docHash,
        networkId: activeNetworkId,
        request: '',
        imageUrl: sealImageUrl(window.location.origin),
      }),
    );
  };

  const handleCoSign = async () => {
    if (!coSignBytes || !file || !loadedCert) return;
    const res = await coSign(loadedCert, coSignBytes, file.name, file.type);
    if (!res) return;

    // On-ledger multi: the co-signer's signature is ROLA (above); we also mint
    // their OWN signature NFT (record) into their Seal collection, so the
    // signing is verifiable on-ledger too. Skipped if they have no Seal yet
    // (their ROLA signature still counts; the NFT is only the on-chain record).
    const request = loadedCert.request;
    const cosigner =
      res.envelope.signatures[res.envelope.signatures.length - 1]?.signerAccount;
    if (request && cosigner) {
      const [seal, collection] = await Promise.all([
        findUserSeal(request.networkId, cosigner),
        findSignCollection(request.networkId, cosigner),
      ]);
      if (seal && collection) {
        await signRequest({
          account: cosigner,
          sealGlobalId: seal.globalId,
          collection: collection.resourceAddress,
          nextId: collection.totalSupply + 1,
          docHash: loadedCert.payload.docHash,
          request: request.requestId,
          imageUrl: sealImageUrl(window.location.origin),
        });
      }
    }

    setResult(res);
    downloadCertificate(res.envelope);
  };

  const startOver = () => {
    setResult(null);
    doc.onFile(null);
    setMessage('');
    setCertFile(null);
    setLoadedCert(null);
    reset();
  };

  if (result) {
    return (
      <ResultPanel
        t={t}
        consoleT={consoleT}
        result={result}
        outputs={outputs}
        onReset={startOver}
      />
    );
  }

  const errorMsg = error
    ? (t.errors as Record<string, string>)[error] ?? t.errors.generic
    : '';
  const hashMismatch =
    coSignMode && !!coSignHash && coSignHash !== loadedCert!.payload.docHash;

  // One-time on-ledger setup, ALONE on screen until completed — nothing
  // else competes for attention. Co-signers arriving via a shared request
  // are exempt (they get a compact inline checklist instead).
  if (needsOnboarding && !sharedRequestId) {
    return (
      <div className="space-y-5">
        <SealDeployPanel t={t} />
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

  // Entry point for off-chain co-signing: drop a certificate to add your
  // signature. Shown FIRST when active, LAST otherwise (the primary flow is
  // signing a new document); hidden for on-ledger request arrivals, where
  // signing happens in the wallet, not against a JSON certificate.
  const cosignBox = (
    <ToolSection title={t.cosign.title} hint={t.cosign.hint}>
      <FileDropzone
        extension=".json"
        label={t.cosign.certLabel}
        prompt={t.cosign.certPrompt}
        file={certFile}
        onFile={onCert}
        error={certError}
        disabled={busy}
      />
    </ToolSection>
  );

  const outputBox = (
    <ToolSection title={t.options.outputTitle} hint={t.options.outputHint}>
      <OptionButtons<OutputFormat>
        multiple
        value={outputs}
        onChange={(v) => {
          // At least one output format must stay selected.
          if (v.length > 0) setOutputs(v);
        }}
        disabled={busy}
        options={[
          {
            value: 'detached',
            label: t.options.outputDetached,
            description: t.options.outputDetachedDesc,
          },
          {
            value: 'embedded',
            label: t.options.outputEmbedded,
            description: t.options.outputEmbeddedDesc,
            disabled: !pdfOk,
            title: pdfOk ? undefined : t.options.embeddedPdfOnly,
          },
        ]}
      />
    </ToolSection>
  );

  const watermarkBox = pdfOk && outputs.includes('embedded') && (
    <ToolSection title={t.seal.watermarkTitle} hint={t.seal.watermarkHint}>
      <OptionButtons<WatermarkKind>
        value={watermark}
        onChange={setWatermark}
        disabled={busy}
        options={[
          {
            value: 'none',
            label: t.seal.watermarkNone,
            description: t.seal.watermarkNoneDesc,
          },
          {
            value: 'seal',
            label: t.seal.watermarkSeal,
            description: t.seal.watermarkSealDesc,
          },
          {
            value: 'own',
            label: t.seal.watermarkOwn,
            description: t.seal.watermarkOwnDesc,
          },
        ]}
      />
      {watermark === 'own' && (
        <div className="space-y-2">
          <input
            value={watermarkText}
            onChange={(e) => setWatermarkText(e.target.value)}
            maxLength={60}
            disabled={busy}
            placeholder={t.seal.watermarkTextPlaceholder}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none disabled:opacity-50"
            style={{
              background: 'var(--color-input-bg, var(--color-card-bg))',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          />
          <FileDropzone
            extension=""
            accept="image/png,image/jpeg"
            label=""
            prompt={t.seal.watermarkImagePrompt}
            file={watermarkImageFile}
            onFile={onWatermarkImage}
            disabled={busy}
          />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t.seal.watermarkImageHint}
          </p>
        </div>
      )}
    </ToolSection>
  );

  return (
    <div className="space-y-5">
      <SealDeployPanel t={t} />

      {coSignMode ? (
        <>
          {cosignBox}
          <SignerProgress t={t} envelope={loadedCert!} />
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
          {errorMsg && (
            <p
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--color-danger, #dc2626)',
                color: 'var(--color-danger, #dc2626)',
              }}
            >
              {errorMsg}
            </p>
          )}
          <button
            type="button"
            disabled={!coSignBytes || hashMismatch || busy}
            onClick={handleCoSign}
            className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {busy ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <FileSignature className="size-4" />
            )}
            {busy ? t.actions.signing : t.cosign.addSignature}
          </button>
        </>
      ) : sharedRequestId ? (
        // Invited co-signer (shared link or carrier PDF): straight to the
        // on-ledger request. No message/identity/output boxes — the first two
        // only apply to ROLA envelope signatures, and the delivery formats
        // travel inside the link, chosen once by the initiator.
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
            outputs={outputs}
            watermark={watermarkOptions}
          />
        </>
      ) : (
        <>
          {cosignBox}

          {/* The signature is ALWAYS the wallet's ROLA proof (also on-ledger),
              which commits to the whole payload, so message + identity always
              apply. The NFT is only the on-chain verification record. */}
          <ToolSection title={t.options.messageTitle} hint={t.options.messageHint}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={2}
              disabled={busy}
              placeholder={t.options.messagePlaceholder}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none outline-none disabled:opacity-50"
              style={{
                background: 'var(--color-input-bg, var(--color-card-bg))',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            />
          </ToolSection>

          <ToolSection
            title={t.options.identityTitle}
            hint={t.options.identityHint}
          >
            <OptionButtons<IdentityOpt>
              multiple
              layout="grid"
              className="grid-cols-2 sm:grid-cols-3"
              value={identityValue}
              onChange={onIdentityChange}
              disabled={busy}
              options={[
                {
                  value: 'none',
                  label: t.options.identityNone,
                  description: t.options.identityNoneDesc,
                },
                {
                  value: 'full_name',
                  label: t.options.identityFull,
                  description: t.options.identityFullDesc,
                },
                {
                  value: 'email',
                  label: t.options.identityEmail,
                  description: t.options.identityEmailDesc,
                },
              ]}
            />
          </ToolSection>

          {outputBox}

          {watermarkBox}

          <ToolSection title={t.options.multiTitle} hint={t.options.multiHint}>
            <OptionButtons<'single' | 'multiple'>
              value={multi ? 'multiple' : 'single'}
              onChange={(v) => setMulti(v === 'multiple')}
              disabled={busy}
              options={[
                {
                  value: 'single',
                  label: t.options.multiSingle,
                  description: t.options.multiSingleDesc,
                },
                {
                  value: 'multiple',
                  label: t.options.multiMultiple,
                  description: t.options.multiMultipleDesc,
                },
              ]}
            />
            {/* The signing method is the same alone or with others — only
                the address list below changes. */}
            <div className="space-y-1.5">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t.onchain.modeTitle}
              </p>
              <OptionButtons<'off' | 'on'>
                value={onchainMode ? 'on' : 'off'}
                onChange={(v) => onOnchainChange(v === 'on')}
                disabled={busy}
                options={[
                  {
                    value: 'off',
                    label: t.onchain.off,
                    description: t.onchain.offDesc,
                  },
                  {
                    value: 'on',
                    label: t.onchain.on,
                    description: t.onchain.onDesc,
                  },
                ]}
              />
            </div>
            {multi && (
              <>
                <StringListField
                  label={t.options.coSignersLabel}
                  values={coSigners}
                  onChange={setCoSigners}
                  addLabel={t.options.addSigner}
                  placeholder={t.options.signerPlaceholder}
                  disabled={busy}
                />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {onchainMode
                    ? t.options.onchainSignersHint
                    : t.options.coSignersHint}
                </p>
                {multiLedger && (
                  <OptionButtons<'sign' | 'send'>
                    value={inviteMode}
                    onChange={setInviteMode}
                    disabled={busy}
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
              </>
            )}
            {multi && (
              <div
                className="rounded-xl border p-3.5 space-y-1.5"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-card-border)',
                }}
              >
                <p
                  className="text-xs font-bold"
                  style={{ color: 'var(--color-text-main)' }}
                >
                  {onchainMode ? t.ledgerSteps.title : t.steps.title}
                </p>
                <ol
                  className="text-xs leading-relaxed list-decimal pl-4 space-y-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {onchainMode ? (
                    <>
                      <li>{t.ledgerSteps.s1}</li>
                      <li>{t.ledgerSteps.s2}</li>
                      <li>{t.ledgerSteps.s3}</li>
                      <li>{t.ledgerSteps.s4}</li>
                    </>
                  ) : (
                    <>
                      <li>{t.steps.s1}</li>
                      <li>{t.steps.s2}</li>
                      <li>{t.steps.s3}</li>
                      <li>{t.steps.s4}</li>
                      <li>{t.steps.s5}</li>
                    </>
                  )}
                </ol>
              </div>
            )}
          </ToolSection>

          {errorMsg && (
            <p
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'var(--color-danger, #dc2626)',
                color: 'var(--color-danger, #dc2626)',
              }}
            >
              {errorMsg}
            </p>
          )}

          <div className={onchainMode ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
            <button
              type="button"
              disabled={!docHash || hashing || busy}
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
            {/* Any on-chain sign mints a tx (invitations for multi, the record
                NFT for a single signer), so it always offers a dry-run. */}
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

// ─── Signer progress (shared) ─────────────────────────────────────────────────

function SignerProgress({
  t,
  envelope,
}: {
  t: SignDictionary;
  envelope: AttestationEnvelope;
}) {
  const required = envelope.payload.signers;
  const signed = new Set(envelope.signatures.map((s) => s.signerAccount));
  const open = required.length === 0;
  const complete = open ? signed.size > 0 : required.every((a) => signed.has(a));
  // Show everyone who has signed (e.g. the initiator) plus any required signer
  // still pending — not just the required list, so a signature never hides.
  const rows = open
    ? Array.from(signed)
    : [...new Set([...required, ...signed])];

  return (
    <ToolSection title={t.progress.signaturesTitle}>
      <p
        className="text-sm font-semibold"
        style={{
          color: complete ? 'var(--color-success)' : 'var(--color-text-muted)',
        }}
      >
        {open
          ? `${signed.size} ${t.progress.signaturesTitle.toLowerCase()}`
          : `${required.filter((a) => signed.has(a)).length} ${t.progress.of} ${required.length}`}{' '}
        · {complete ? t.progress.allSigned : t.progress.partial}
      </p>
      <ul className="space-y-1.5 text-sm">
        {rows.map((acc) => (
          <li key={acc} className="flex items-center gap-2">
            {signed.has(acc) ? (
              <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
            ) : (
              <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            )}
            <span
              className="font-mono text-[12px] break-all"
              style={{ color: 'var(--color-text-main)' }}
            >
              {acc}
            </span>
          </li>
        ))}
      </ul>
      {!complete && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t.progress.passToNext}
        </p>
      )}
    </ToolSection>
  );
}

// ─── Result panel ─────────────────────────────────────────────────────────────

export function ResultPanel({
  t,
  consoleT,
  result,
  outputs,
  onReset,
  allowAnchor = true,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  result: SignResult;
  outputs: OutputFormat[];
  onReset: () => void;
  /** Basic mode hides the on-ledger anchoring option entirely. */
  allowAnchor?: boolean;
}) {
  const [envelope, setEnvelope] = useState<AttestationEnvelope>(result.envelope);
  const { anchor, phase, error } = useDocumentSign();
  const preview = useTransactionPreview();
  const { language } = useLanguage();
  const { activeNetworkId } = useRadixWallet();
  const anchoring = phase === 'anchoring';

  const { payload } = envelope;
  const pdfBtn = outputs.includes('embedded') && isPdfResult(result);
  const certBtn = outputs.includes('detached') || !pdfBtn;

  const signed = new Set(envelope.signatures.map((s) => s.signerAccount));
  const complete =
    payload.signers.length === 0
      ? signed.size > 0
      : payload.signers.every((a) => signed.has(a));
  // A request-based (multi on-ledger) certificate records each signer's NFT as
  // they sign, so it never needs the stand-alone anchor step.
  const canAnchor =
    allowAnchor && complete && !envelope.onChain && !envelope.request;

  const anchorSigners = [...signed];
  const anchorAccount = anchorSigners[0] ?? null;
  // Anchoring mints the signature into the signer's Seal-owned collection, so
  // that account needs its Seal + collection first. If missing, we show the
  // onboarding inline before the anchor button.
  const setup = useSealSetup(anchorAccount);
  const needsSetup = canAnchor && setup.ready && (!setup.seal || !setup.collection);
  const anchorErrorMsg = error
    ? (t.errors as Record<string, string>)[error] ?? t.errors.generic
    : '';

  const onSimulate = async () => {
    if (!anchorAccount || activeNetworkId == null || !setup.seal) return;
    const imageUrl = sealImageUrl(window.location.origin);
    // Preview the SAME manifest the anchor will submit: a stand-alone signature
    // (`request=''`) minted into the signer's Seal-owned collection (model 1).
    const manifest = setup.collection
      ? buildSignatureMintManifest({
          account: anchorAccount,
          sealGlobalId: setup.seal.globalId,
          collection: setup.collection.resourceAddress,
          nextId: setup.collection.totalSupply + 1,
          docHash: payload.docHash,
          networkId: activeNetworkId,
          request: '',
          imageUrl,
        })
      : buildSignCollectionCreateManifest({
          account: anchorAccount,
          sealGlobalId: setup.seal.globalId,
          sealAddress: radixSealAddress(activeNetworkId),
          networkId: activeNetworkId,
          collectionName: '',
          imageUrl,
          firstSignature: {
            docHash: payload.docHash,
            request: '',
            signedAt: new Date().toISOString(),
          },
        });
    preview.simulate(manifest);
  };

  const onAnchor = async () => {
    const res = await anchor(
      envelope,
      result.fileBytes,
      result.fileName,
      result.fileType,
    );
    if (res) {
      setEnvelope(res.envelope);
      downloadCertificate(res.envelope);
    }
  };

  const downloadPdf = async () => {
    try {
      // Embed the original bytes so the signed PDF verifies on its own.
      const pdf = await embedCertificateInPdf(result.fileBytes, envelope, result.fileBytes);
      downloadBytes(
        pdf,
        `${stripExtension(result.fileName)}-signed.pdf`,
        'application/pdf',
      );
    } catch {
      downloadCertificate(envelope);
    }
  };

  return (
    <div className="space-y-5">
      <ToolSection>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
            <UsersRound className="size-5 text-white" />
          </div>
          <h3
            className="text-base font-bold"
            style={{ color: 'var(--color-text-main)' }}
          >
            {t.result.title}
          </h3>
        </div>

        <dl className="grid gap-2 text-sm">
          <Row label={t.result.timestamp} value={new Date(payload.timestamp).toLocaleString()} />
          <Row label={t.result.hash} value={payload.docHash} mono />
          {payload.message && (
            <Row label={t.result.message} value={payload.message} />
          )}
        </dl>
      </ToolSection>

      <SignerProgress t={t} envelope={envelope} />

      {envelope.request && (
        // Multi-party on-ledger: the link co-signers open to see the request
        // and co-sign, with the direct document channel available by default.
        <ShareLinkSection
          t={t}
          requestKey={envelope.request.requestId}
          docName={payload.fileName}
          fileName={result.fileName}
          fileType={result.fileType}
          bytes={result.fileBytes}
          outputs={outputs}
        />
      )}

      {canAnchor && needsSetup && (
        <SealOnboarding
          t={t}
          account={anchorAccount}
          onAccountChange={() => {}}
          setup={setup}
          lockedAccount
          consoleT={consoleT}
        />
      )}

      {canAnchor && !needsSetup && (
        <ToolSection title={t.options.anchorTitle} hint={t.options.anchorHint}>
          <p className="text-xs" style={{ color: 'var(--color-warning, #b45309)' }}>
            ⚠ {t.options.anchorWarning}
          </p>
          {anchorErrorMsg && (
            <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
              {anchorErrorMsg}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={anchoring}
              onClick={onAnchor}
              className="flex w-full items-center justify-center gap-2 px-6 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {anchoring ? (
                <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              {anchoring ? t.actions.anchoringNow : t.actions.anchorNow}
            </button>
            <SimulateButton
              t={consoleT.simulate}
              onClick={onSimulate}
              disabled={anchoring}
              loading={preview.isSimulating}
            />
          </div>
          <SimulateResultCard
            t={consoleT.simulate}
            preview={preview.preview}
            error={preview.error}
            onClose={preview.reset}
          />
        </ToolSection>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {certBtn && (
          <button
            type="button"
            onClick={() => downloadCertificate(envelope)}
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
          >
            <Download className="size-4" />
            {t.actions.downloadCert}
          </button>
        )}
        {pdfBtn && (
          <button
            type="button"
            onClick={downloadPdf}
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
          >
            <Download className="size-4" />
            {t.actions.downloadPdf}
          </button>
        )}

        {envelope.onChain && (
          <a
            href={explorerTxUrl(language, envelope.onChain.transactionIntentHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
            style={{
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          >
            <ExternalLink className="size-4" />
            {t.actions.viewOnLedger}
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={onReset}
        className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <RotateCcw className="size-4" />
        {t.actions.newSignature}
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3">
      <dt
        className="sm:w-40 shrink-0 font-semibold"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </dt>
      <dd
        className={`break-all ${mono ? 'font-mono text-[12px]' : ''}`}
        style={{ color: 'var(--color-text-main)' }}
      >
        {value}
      </dd>
    </div>
  );
}
