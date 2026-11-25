'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useSealRequest, useSealSetup } from '../hooks/useSealRequest';
import type { DocumentFile } from '../hooks/useDocumentFile';
import {
  buildSignRequestManifest,
  buildSignatureOrFirstCollectionManifest,
  resolveRequestSigners,
} from '../lib/sign-request';
import { embedRequestInPdf } from '../lib/pdf-embed';
import type { WatermarkOptions } from '../lib/pdf-watermark';
import { useLanguage } from '@/context/LanguageContext';
import type { OutputFormat } from '../types/sign.types';
import {
  buildOnChainCertificate,
  downloadBytes,
  downloadCertificate,
} from '../lib/certificate';
import { deliverSignedArtifacts } from '../lib/signed-pdf';
import { accountPrefixForNetwork, networkIdFromResource } from '../lib/network';
import { randomNonceHex } from '../lib/hash';
import { ShareLinkSection } from './ShareLinkSection';
import { RequestTransactionLinks } from './RequestTransactionLinks';
import { requestPdfName } from '../lib/file';
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import { fetchLedgerNow } from '../lib/ledger-time';
import { fetchOnChainStatus } from '../services/signApi';
import type { SignDictionary } from '../types/dictionary';
import { OnChainCreateView } from './onchain/OnChainCreateView';
import {
  OnChainCompletedSection,
  OnChainSignerProgressSection,
} from './onchain/OnChainRequestProgress';
import { OnChainCoSignSection } from './onchain/OnChainCoSignSection';
import {
  OnChainDanger,
  OnChainManualKey,
  OnChainMuted,
  OnChainRequestSummary,
  type InviteMode,
} from './onchain/OnChainPrimitives';

const REFRESH_MS = 30_000;

/**
 * On-ledger signing panel — orchestrates request creation, live status polling,
 * co-signing, and completed certificate downloads.
 */
export function OnChainSignPanel({
  t,
  consoleT,
  doc,
  requiredSigners,
  initialRequestId,
  account,
  solo,
  outputs,
  watermark,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  doc: DocumentFile;
  requiredSigners: string[];
  initialRequestId?: string;
  /** Acting account (selected during onboarding / first shared account). */
  account: string | null;
  /** Single-signer mode: the invitation list is implicitly [account]. */
  solo: boolean;
  /** Delivery formats chosen for the completed certificate. */
  outputs: OutputFormat[];
  /** Watermark applied to the delivered (signed) PDF. */
  watermark: WatermarkOptions;
}) {
  const { activeNetworkId, accounts } = useRadixWallet();
  const { language } = useLanguage();
  const { mintSeal, createCollection, createRequest, signRequest, phase, error } =
    useSealRequest();
  const preview = useTransactionPreview();

  const docHash = doc.docHash;
  const [inviteMode, setInviteMode] = useState<InviteMode>('sign');
  const [requestId, setRequestId] = useState(initialRequestId ?? '');
  const [keyInput, setKeyInput] = useState(initialRequestId ?? '');

  const sealDeployed = !!activeNetworkId && !!radixSealAddress(activeNetworkId);
  const nftImage =
    typeof window !== 'undefined' ? sealImageUrl(window.location.origin) : '';

  const requestNetworkId = requestId ? networkIdFromResource(requestId) : null;
  const statusNetworkId = requestNetworkId ?? activeNetworkId;
  const wrongNetwork =
    requestNetworkId != null &&
    activeNetworkId != null &&
    requestNetworkId !== activeNetworkId;

  const statusQuery = useQuery({
    queryKey: ['sign-onchain-status', statusNetworkId, requestId],
    queryFn: () =>
      fetchOnChainStatus({ networkId: statusNetworkId!, requestId }),
    enabled: !!requestId && statusNetworkId != null,
    refetchInterval: (query) =>
      query.state.data?.found && !query.state.data.complete
        ? REFRESH_MS
        : false,
  });
  const status = statusQuery.data?.found ? statusQuery.data : null;
  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  /* ── Eligibility (UX only — the real checks live on the ledger) ── */
  const walletAddresses = new Set(accounts.map((a) => a.address));
  const signatures = status?.signatures ?? [];
  const myEntries = signatures.filter((s) => walletAddresses.has(s.account));
  const myPending = myEntries.filter((s) => !s.signed);
  const signerAccount = myPending[0]?.account ?? myEntries[0]?.account ?? null;

  const actingAccount = requestId ? signerAccount : account;
  const setup = useSealSetup(actingAccount);

  const hashMismatch =
    !!status?.docHash && !!docHash && status.docHash !== docHash;
  const loading = statusQuery.isFetching;
  const notFound =
    !!requestId && !statusQuery.isFetching && statusQuery.data?.found === false;

  /* ── Create request (solo = invitation list is just yourself) ── */
  const cleanSigners = requiredSigners.map((s) => s.trim()).filter(Boolean);
  const alsoSign = solo ? true : inviteMode === 'sign';
  const effectiveSigners = solo
    ? account
      ? [account]
      : []
    : resolveRequestSigners(account, cleanSigners, alsoSign);
  const expectedPrefix = accountPrefixForNetwork(activeNetworkId ?? 2);
  const invalidSigner = solo
    ? undefined
    : cleanSigners.find((s) => !s.startsWith(expectedPrefix));
  const setupReady = !!setup.seal && !!setup.collection;
  const canCreate =
    !!account &&
    !!docHash &&
    !busy &&
    setupReady &&
    effectiveSigners.length > 0 &&
    !invalidSigner;

  const onCreate = async () => {
    if (!canCreate || !setup.seal || !setup.collection) return;
    const created = await createRequest({
      account: account!,
      sealGlobalId: setup.seal.globalId,
      collection: setup.collection.resourceAddress,
      nextId: setup.collection.totalSupply + 1,
      docHash,
      requiredSigners: effectiveSigners,
      alsoSign,
      imageUrl: nftImage,
    });
    if (created) {
      setRequestId(created.key);
      setup.refetch();
    }
  };

  const simulateCreate = async () => {
    if (!canCreate || !setup.seal || !setup.collection) return;
    preview.simulate(
      buildSignRequestManifest({
        issuedAt: await fetchLedgerNow(activeNetworkId ?? 2),
        account: account!,
        sealGlobalId: setup.seal.globalId,
        collection: setup.collection.resourceAddress,
        nextId: setup.collection.totalSupply + 1,
        docHash,
        networkId: activeNetworkId ?? 2,
        requiredSigners: effectiveSigners,
        alsoSign,
        imageUrl: nftImage,
      }),
    );
  };

  /* ── Sign (invited co-signer) ── */
  const eligible = !!signerAccount;
  const alreadySigned =
    eligible && myPending.length === 0 && myEntries.some((s) => s.signed);
  const canSign =
    eligible &&
    !alreadySigned &&
    !wrongNetwork &&
    !!status?.docHash &&
    !!docHash &&
    !hashMismatch &&
    !!setup.seal &&
    !busy;

  const onSign = async () => {
    if (!canSign || !status?.docHash || !setup.seal || !signerAccount) return;
    const ok = setup.collection
      ? !!(await signRequest({
          account: signerAccount,
          sealGlobalId: setup.seal.globalId,
          collection: setup.collection.resourceAddress,
          nextId: setup.collection.totalSupply + 1,
          docHash: status.docHash,
          request: status.requestId ?? requestId,
          imageUrl: nftImage,
        }))
      : !!(await createCollection({
          account: signerAccount,
          sealGlobalId: setup.seal.globalId,
          collectionName: '',
          imageUrl: nftImage,
          firstSignature: {
            docHash: status.docHash,
            request: status.requestId ?? requestId,
          },
        }));
    if (ok) {
      setup.refetch();
      statusQuery.refetch();
    }
  };

  const simulateSign = async () => {
    if (!canSign || !status?.docHash || !setup.seal || !signerAccount) return;
    const issuedAt = await fetchLedgerNow(activeNetworkId ?? 2);
    preview.simulate(
      buildSignatureOrFirstCollectionManifest({
        account: signerAccount,
        sealGlobalId: setup.seal.globalId,
        sealAddress: radixSealAddress(activeNetworkId ?? 2),
        collection: setup.collection?.resourceAddress ?? null,
        nextId: setup.collection ? setup.collection.totalSupply + 1 : 1,
        docHash: status.docHash,
        networkId: activeNetworkId ?? 2,
        request: status.requestId ?? requestId,
        imageUrl: nftImage,
        issuedAt,
      }),
    );
  };

  /* ── Share & download helpers ── */
  const canShareAsPdf =
    !!status &&
    doc.pdf &&
    !doc.embeddedRequest &&
    !!doc.bytes &&
    !!doc.file &&
    !hashMismatch;

  const downloadRequestPdf = async () => {
    if (!canShareAsPdf || !status?.docHash || activeNetworkId == null) return;
    try {
      const pdf = await embedRequestInPdf(
        doc.bytes!,
        {
          v: 1,
          requestKey: status.requestId ?? requestId,
          networkId: activeNetworkId,
          docHash: status.docHash,
        },
        doc.bytes!,
        doc.file!.name,
      );
      downloadBytes(pdf, requestPdfName(doc.file!.name), 'application/pdf');
    } catch {
      /* the share link keeps working */
    }
  };

  const onChainCertificate = () =>
    buildOnChainCertificate({
      docHash: status?.docHash ?? docHash,
      fileName: doc.file?.name ?? 'document',
      fileSize: doc.file?.size ?? 0,
      networkId: activeNetworkId ?? 2,
      requiredSigners: status?.requiredSigners ?? [],
      signedAccounts: (status?.signatures ?? [])
        .filter((s) => s.signed)
        .map((s) => ({
          account: s.account,
          signedAt: s.signedAt,
          txId: s.txId,
          nft: s.nftGlobalId,
        })),
      nonce: randomNonceHex(),
      requestId: status?.requestId ?? requestId,
      createdAt: status?.createdAt,
      requestTxId: status?.createdTxId,
    });

  const downloadsBlocked = busy || statusQuery.isFetching;
  const downloadCert = () => downloadCertificate(onChainCertificate());

  const downloadSignedPdf = async () => {
    const cert = onChainCertificate();
    await deliverSignedArtifacts({
      envelope: cert,
      fileBytes: doc.pdf ? doc.bytes : null,
      fileName: doc.file?.name ?? 'document',
      fileType: doc.file?.type ?? '',
      outputs: ['embedded'],
      t,
      locale: language,
      watermark,
    });
  };

  if (!requestId) {
    return (
      <OnChainCreateView
        t={t}
        consoleT={consoleT}
        solo={solo}
        inviteMode={inviteMode}
        onInviteModeChange={setInviteMode}
        alsoSign={alsoSign}
        docHash={docHash}
        cleanSignersCount={cleanSigners.length}
        invalidSigner={invalidSigner}
        errorCode={error}
        busy={busy}
        canCreate={canCreate}
        onCreate={onCreate}
        onSimulate={simulateCreate}
        preview={preview}
        keyInput={keyInput}
        onKeyInputChange={setKeyInput}
        onLoadKey={() => setRequestId(keyInput.trim())}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ToolSection title={t.onchain.summaryTitle}>
        {status && <OnChainRequestSummary t={t} status={status} />}
        {notFound && <OnChainDanger text={t.onchain.notFound} />}
        {hashMismatch && <OnChainDanger text={t.onchain.fileMismatch} />}
        {!docHash && <OnChainMuted text={t.onchain.needFile} />}
        {status && !!docHash && !hashMismatch && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
            <CheckCircle2 className="size-3.5 shrink-0" />
            {t.onchain.hashMatches}
          </p>
        )}
      </ToolSection>

      {requestId && status && !status.complete && !initialRequestId && (
        <ShareLinkSection
          t={t}
          requestKey={status.requestId ?? requestId}
          docName={doc.file?.name}
          fileName={doc.file?.name ?? null}
          fileType={doc.file?.type ?? null}
          bytes={doc.bytes}
          outputs={outputs}
          watermark={{ kind: watermark.kind, text: watermark.text }}
          networkId={statusNetworkId ?? undefined}
        >
          {status.createdTxId && (
            <RequestTransactionLinks
              t={t}
              txId={status.createdTxId}
              networkId={statusNetworkId ?? undefined}
            />
          )}
          {canShareAsPdf && (
            <>
              <button
                type="button"
                onClick={downloadRequestPdf}
                className="flex items-center gap-2 text-xs font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                <Download className="size-3.5" />
                {t.onchain.downloadRequestPdf}
              </button>
              <OnChainMuted text={t.onchain.downloadRequestPdfHint} />
            </>
          )}
        </ShareLinkSection>
      )}

      <OnChainSignerProgressSection
        t={t}
        status={status}
        walletAddresses={walletAddresses}
        loading={loading}
        onRefresh={() => statusQuery.refetch()}
      />

      {status?.complete ? (
        <OnChainCompletedSection
          t={t}
          status={status}
          statusNetworkId={statusNetworkId}
          outputs={outputs}
          isPdf={doc.pdf}
          downloadsBlocked={downloadsBlocked}
          onDownloadCert={downloadCert}
          onDownloadPdf={downloadSignedPdf}
        />
      ) : (
        <OnChainCoSignSection
          t={t}
          consoleT={consoleT}
          status={status}
          hasStatusData={!!statusQuery.data}
          statusError={statusQuery.isError}
          loading={loading}
          notFound={notFound}
          wrongNetwork={wrongNetwork}
          requestNetworkId={requestNetworkId}
          eligible={eligible}
          alreadySigned={alreadySigned}
          docHash={docHash}
          hashMismatch={hashMismatch}
          actingAccount={actingAccount}
          setup={setup}
          sealDeployed={sealDeployed}
          busy={busy}
          phase={phase}
          errorCode={error}
          canSign={canSign}
          onMintSeal={async () => {
            if (!actingAccount) return;
            const ok = await mintSeal({
              account: actingAccount,
              imageUrl: nftImage,
            });
            if (ok) setup.refetch();
          }}
          onSign={onSign}
          onSimulate={simulateSign}
          preview={preview}
        />
      )}

      <OnChainManualKey
        t={t}
        value={keyInput}
        onChange={setKeyInput}
        onLoad={() => setRequestId(keyInput.trim())}
        busy={busy}
      />
    </div>
  );
}
