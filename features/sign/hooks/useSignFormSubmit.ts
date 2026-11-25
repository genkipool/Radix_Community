'use client';

import { useLanguage } from '@/context/LanguageContext';
import type { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { sealImageUrl } from '../constants/seal';
import { createAttestationPayload } from '../lib/certificate';
import { randomNonceHex } from '../lib/hash';
import { fetchLedgerNow, fetchTransactionTime } from '../lib/ledger-time';
import type { P12Info } from '../lib/pdf-pades';
import type { WatermarkOptions } from '../lib/pdf-watermark';
import {
  buildSignRequestManifest,
  buildSignatureMintManifest,
  nftGlobalId,
  resolveRequestSigners,
} from '../lib/sign-request';
import { deliverSignedArtifacts } from '../lib/signed-pdf';
import { findSealAndCollection } from '../services/sealDiscovery';
import type { SignDictionary } from '../types/dictionary';
import type {
  AttestationEnvelope,
  DisclosurePolicy,
  OutputFormat,
  SignResult,
} from '../types/sign.types';
import type { PadesConfig } from '../components/PadesSignSection';
import { padesErrorCode } from '../components/SignResultPanel';
import type { useDocumentSign } from './useDocumentSign';
import type { useSealRequest, useSealSetup } from './useSealRequest';

/**
 * Records the X.509 identity on the signer's OWN (newest) signature entry so
 * it survives subsequent co-sign rebuilds.
 */
function withSignerCertificate(
  res: SignResult,
  info: P12Info | null,
): SignResult {
  const signatures = res.envelope.signatures;
  if (!info || signatures.length === 0) return res;
  const updated = [...signatures];
  updated[updated.length - 1] = {
    ...updated[updated.length - 1],
    certificate: {
      subjectCN: info.subjectCN,
      subjectO: info.subjectO,
      issuer: info.issuer,
      serialNumber: info.serialNumber,
      validFrom: info.validFrom.toISOString(),
      validTo: info.validTo.toISOString(),
    },
  };
  return { ...res, envelope: { ...res.envelope, signatures: updated } };
}

/**
 * Orchestrates signing, co-signing, artifact delivery, and dry-run transaction
 * previews for {@link SignForm}.
 */
export function useSignFormSubmit({
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
  setBlockedAccount,
  loadedCert,
  coSignBytes,
  cosignRequest,
  cosignAccount,
  cosignSetup,
  cosignNeedsSetup,
  sign,
  coSign,
  createRequest,
  signRequest,
  invitePreview,
}: {
  t: SignDictionary;
  file: File | null;
  bytes: Uint8Array | null;
  docHash: string;
  message: string;
  disclosure: DisclosurePolicy;
  includeEmail: boolean;
  multi: boolean;
  coSigners: string[];
  onchainMode: boolean;
  multiLedger: boolean;
  inviteMode: 'sign' | 'send';
  onchainAccount: string | null;
  setup: ReturnType<typeof useSealSetup>;
  effectiveOutputs: OutputFormat[];
  watermarkOptions: WatermarkOptions;
  pades: PadesConfig;
  padesCert: P12Info | null;
  padesActive: boolean;
  setPadesError: (msg: string) => void;
  setResult: (res: SignResult | null) => void;
  setSetupError: (err: string) => void;
  setBlockedAccount: (acc: string | null) => void;
  loadedCert: AttestationEnvelope | null;
  coSignBytes: Uint8Array | null;
  cosignRequest: AttestationEnvelope['request'] | null;
  cosignAccount: string | null;
  cosignSetup: ReturnType<typeof useSealSetup>;
  cosignNeedsSetup: boolean;
  sign: ReturnType<typeof useDocumentSign>['sign'];
  coSign: ReturnType<typeof useDocumentSign>['coSign'];
  createRequest: ReturnType<typeof useSealRequest>['createRequest'];
  signRequest: ReturnType<typeof useSealRequest>['signRequest'];
  invitePreview: ReturnType<typeof useTransactionPreview>;
}) {
  const { activeNetworkId } = useRadixWallet();
  const { language } = useLanguage();

  const deliver = async (res: SignResult, chosen: OutputFormat[]) => {
    setPadesError('');
    await deliverSignedArtifacts({
      envelope: res.envelope,
      fileBytes: res.fileBytes,
      fileName: res.fileName,
      fileType: res.fileType,
      outputs: chosen,
      t,
      locale: language,
      watermark: watermarkOptions,
      pades: padesActive ? pades : null,
      onPadesError: (err) => setPadesError(padesErrorCode(err)),
    });
  };

  const handleSign = async () => {
    if (!bytes || !docHash || !file || activeNetworkId == null) return;
    const cleanCoSigners = coSigners.map((s) => s.trim()).filter(Boolean);
    const sendOnly = multiLedger && inviteMode === 'send';

    let finalRes: SignResult;
    if (sendOnly) {
      finalRes = {
        envelope: {
          payload: createAttestationPayload({
            docHash,
            fileName: file.name,
            fileSize: file.size,
            message: message.trim(),
            disclosure,
            email: includeEmail,
            signers: cleanCoSigners,
            sortSigners: true,
            timestamp: await fetchLedgerNow(activeNetworkId),
            networkId: activeNetworkId,
            nonce: randomNonceHex(),
          }),
          signatures: [],
          onChain: null,
        },
        fileBytes: bytes,
        fileName: file.name,
        fileType: file.type,
      };
    } else {
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
      finalRes = padesActive ? withSignerCertificate(res, padesCert) : res;
    }

    const requestSigners = resolveRequestSigners(
      onchainAccount,
      cleanCoSigners,
      !sendOnly,
    );

    if (multiLedger) {
      if (!setup.seal || !setup.collection || !onchainAccount) return;
      const created = await createRequest({
        account: onchainAccount,
        sealGlobalId: setup.seal.globalId,
        collection: setup.collection.resourceAddress,
        nextId: setup.collection.totalSupply + 1,
        docHash,
        requiredSigners: requestSigners,
        alsoSign: !sendOnly,
        imageUrl: sealImageUrl(window.location.origin),
      });
      if (!created) return;
      const committedAt = await fetchTransactionTime(
        finalRes.envelope.payload.networkId,
        created.transactionIntentHash,
      );
      finalRes = {
        ...finalRes,
        envelope: {
          ...finalRes.envelope,
          request: {
            networkId: finalRes.envelope.payload.networkId,
            requestId: created.key,
            transactionIntentHash: created.transactionIntentHash,
          },
          signatures: finalRes.envelope.signatures.map((entry) =>
            entry.signerAccount === onchainAccount && !sendOnly
              ? {
                  ...entry,
                  transactionIntentHash: created.transactionIntentHash,
                  signedAt: committedAt ?? entry.signedAt,
                  ...(created.signatureNft
                    ? { signatureNft: created.signatureNft }
                    : {}),
                }
              : entry,
          ),
        },
      };
    }

    setResult(finalRes);
    await deliver(finalRes, effectiveOutputs);
  };

  const handleCoSign = async () => {
    if (!coSignBytes || !file || !loadedCert || cosignNeedsSetup) return;
    setSetupError('');
    setBlockedAccount(null);
    const signed = await coSign(loadedCert, coSignBytes, file.name, file.type);
    if (!signed) return;
    let res = padesActive ? withSignerCertificate(signed, padesCert) : signed;

    const request = loadedCert.request;
    const cosigner =
      res.envelope.signatures[res.envelope.signatures.length - 1]?.signerAccount;
    if (request && cosigner) {
      const { seal, collection } = await findSealAndCollection(
        request.networkId,
        cosigner,
      );
      if (!seal || !collection) {
        setBlockedAccount(cosigner);
        setSetupError('seal_required');
        return;
      }
      const nextId = collection.totalSupply + 1;
      const txId = await signRequest({
        account: cosigner,
        sealGlobalId: seal.globalId,
        collection: collection.resourceAddress,
        nextId,
        docHash: loadedCert.payload.docHash,
        request: request.requestId,
        imageUrl: sealImageUrl(window.location.origin),
      });
      if (!txId) return;
      const committedAt = await fetchTransactionTime(request.networkId, txId);
      res = {
        ...res,
        envelope: {
          ...res.envelope,
          signatures: res.envelope.signatures.map((entry, i) =>
            i === res.envelope.signatures.length - 1
              ? {
                  ...entry,
                  transactionIntentHash: txId,
                  signedAt: committedAt ?? entry.signedAt,
                  signatureNft: nftGlobalId(collection.resourceAddress, nextId),
                }
              : entry,
          ),
        },
      };
    }

    setResult(res);
    await deliver(res, effectiveOutputs);
  };

  const downloadSignedDoc = async () => {
    if (!loadedCert) return;
    setPadesError('');
    await deliverSignedArtifacts({
      envelope: loadedCert,
      fileBytes: coSignBytes,
      fileName: file?.name ?? loadedCert.payload.fileName,
      fileType: file?.type ?? '',
      outputs: ['embedded'],
      t,
      locale: language,
      watermark: watermarkOptions,
      pades: padesActive ? pades : null,
      onPadesError: (err) => setPadesError(padesErrorCode(err)),
    });
  };

  const onSimulateInvite = async () => {
    if (
      !docHash ||
      activeNetworkId == null ||
      !setup.seal ||
      !setup.collection ||
      !onchainAccount
    ) {
      return;
    }
    const alsoSign = inviteMode === 'sign';
    const requestSigners = resolveRequestSigners(
      onchainAccount,
      coSigners,
      alsoSign,
    );
    if (requestSigners.length === 0) return;
    invitePreview.simulate(
      buildSignRequestManifest({
        issuedAt: await fetchLedgerNow(activeNetworkId),
        account: onchainAccount,
        sealGlobalId: setup.seal.globalId,
        collection: setup.collection.resourceAddress,
        nextId: setup.collection.totalSupply + 1,
        docHash,
        networkId: activeNetworkId,
        requiredSigners: requestSigners,
        alsoSign,
        imageUrl: sealImageUrl(window.location.origin),
      }),
    );
  };

  const onSimulateSign = async () => {
    if (
      !docHash ||
      activeNetworkId == null ||
      !onchainAccount ||
      !setup.seal ||
      !setup.collection
    ) {
      return;
    }
    invitePreview.simulate(
      buildSignatureMintManifest({
        issuedAt: await fetchLedgerNow(activeNetworkId),
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

  const onSimulateCoSign = async () => {
    if (
      !cosignRequest ||
      !cosignAccount ||
      !cosignSetup.seal ||
      !cosignSetup.collection ||
      !loadedCert
    ) {
      return;
    }
    invitePreview.simulate(
      buildSignatureMintManifest({
        issuedAt: await fetchLedgerNow(cosignRequest.networkId),
        account: cosignAccount,
        sealGlobalId: cosignSetup.seal.globalId,
        collection: cosignSetup.collection.resourceAddress,
        nextId: cosignSetup.collection.totalSupply + 1,
        docHash: loadedCert.payload.docHash,
        networkId: cosignRequest.networkId,
        request: cosignRequest.requestId,
        imageUrl: sealImageUrl(window.location.origin),
      }),
    );
  };

  return {
    handleSign,
    handleCoSign,
    downloadSignedDoc,
    onSimulateInvite,
    onSimulateSign,
    onSimulateCoSign,
  };
}
