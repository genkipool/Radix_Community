'use client';

import { useEffect, useState } from 'react';
import { FileSignature } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useDocumentSign } from '../hooks/useDocumentSign';
import { usePadesCertificate } from '../hooks/usePadesCertificate';
import { useSealRequest, useSealSetup, useSealSetups } from '../hooks/useSealRequest';
import { findSealAndCollection } from '../services/sealDiscovery';
import type { DocumentFile } from '../hooks/useDocumentFile';
import { OnChainSignPanel } from './OnChainSignPanel';
import { SealOnboarding } from './SealOnboarding';
import { SignErrorText } from './SignErrorText';
import { SignCoSignView } from './SignCoSignView';
import { ResultPanel, padesErrorCode } from './SignResultPanel';
import {
  MultiModeSection,
  OutputFormatSection,
  WatermarkSection,
} from './SignDeliverySections';

export { ResultPanel };
import {
  createAttestationPayload,
  isFullySigned,
  looksLikeEnvelope,
} from '../lib/certificate';
import { deliverSignedArtifacts } from '../lib/signed-pdf';
import type { P12Info } from '../lib/pdf-pades';
import { PadesSignSection } from './PadesSignSection';
import type { WatermarkKind, WatermarkOptions } from '../lib/pdf-watermark';
import {
  buildSignRequestManifest,
  buildSignatureMintManifest,
  nftGlobalId,
  resolveRequestSigners,
} from '../lib/sign-request';
import { fetchLedgerNow, fetchTransactionTime } from '../lib/ledger-time';
import {
  identitySelection,
  nextIdentityChoice,
  type IdentityOption,
} from '../lib/identity-options';
import { blake2b256Hex, randomNonceHex } from '../lib/hash';
import type { SharedWatermark } from '../lib/share';
import { extractRadixAttachments, isPdfBytes } from '../lib/pdf-extract';
import { sealImageUrl } from '../constants/seal';
import type { SignDictionary } from '../types/dictionary';
import type {
  AttestationEnvelope,
  DisclosurePolicy,
  OutputFormat,
  SignResult,
} from '../types/sign.types';

type IdentityOpt = IdentityOption;

/**
 * Records the X.509 identity on the signer's OWN (newest) signature entry, so
 * it travels inside the certificate. Co-signing rebuilds the PDF from the
 * original — which drops the previous PAdES signature — so without this the
 * earlier signer's certificate would disappear from the signed document.
 */
function withSignerCertificate(res: SignResult, info: P12Info | null): SignResult {
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
  // Until the user picks for themselves, a PDF also gets the embedded PDF: it
  // is the self-contained artifact (certificate + original + visible page in
  // one file), so it should not take an extra click to obtain.
  const [outputsPicked, setOutputsPicked] = useState(
    !!sharedOutputs && sharedOutputs.length > 0,
  );
  const effectiveOutputs: OutputFormat[] =
    !outputsPicked && pdfOk ? [...new Set([...outputs, 'embedded' as const])] : outputs;
  // Watermark for the embedded (signed) PDF. Presentation only: the original is
  // embedded intact, so the document hash is unaffected.
  const [watermark, setWatermark] = useState<WatermarkKind>(
    sharedWatermark?.kind ?? 'none',
  );
  const [watermarkText, setWatermarkText] = useState(sharedWatermark?.text ?? '');
  // Watermark carried inside a dropped signed PDF: it belongs to the document,
  // not to this signer, so it is reused as-is and its picker stays hidden.
  const [inheritedWatermark, setInheritedWatermark] =
    useState<WatermarkOptions | null>(null);
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
  const [setupError, setSetupError] = useState('');
  /**
   * The account the wallet actually signed with when it turned out to have no
   * collection of its own. It is not necessarily the one checked beforehand:
   * the signer picks the account in the wallet, and several of theirs may be
   * invited. Kept so the setup box below is offered for THAT account.
   */
  const [blockedAccount, setBlockedAccount] = useState<string | null>(null);

  const { sign, coSign, phase, error, reset } = useDocumentSign();
  const {
    createRequest,
    signRequest,
    phase: ledgerPhase,
    error: ledgerError,
  } = useSealRequest();
  const invitePreview = useTransactionPreview();
  const { activeNetworkId, accounts } = useRadixWallet();
  const { language } = useLanguage();

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
          // The document already has a look chosen by whoever started it: keep
          // it verbatim (rebuilding from the original would otherwise strip it)
          // and do not offer a second, competing watermark.
          setInheritedWatermark(att.watermark);
          return;
        }
      }
      if (!cancelled) {
        setCoSignBytes(bytes);
        setCoSignHash(docHash);
        setInheritedWatermark(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, docHash]);

  // The ledger leg counts as busy too: the wallet is holding a transaction the
  // whole time, and leaving the button live invited a second one on top of it.
  const ledgerBusy =
    ledgerPhase !== 'idle' && ledgerPhase !== 'done' && ledgerPhase !== 'error';
  const busy = phase === 'signing' || phase === 'anchoring' || ledgerBusy;
  const coSignMode = !!loadedCert;
  // A dropped certificate/PDF whose whole required-signer set has ALREADY
  // signed: nothing left to add, so the primary action becomes downloading the
  // signed artifact. Open certificates (no required set) keep accepting
  // signatures, so they never switch to download-only.
  const coSignComplete =
    coSignMode &&
    loadedCert!.payload.signers.length > 0 &&
    isFullySigned(loadedCert!);
  // An inherited watermark wins: the document's look was decided by whoever
  // started it, and every co-signer must reproduce it exactly.
  const watermarkOptions: WatermarkOptions = inheritedWatermark ?? {
    kind: watermark,
    text: watermarkText,
    imageUrl: watermark === 'own' ? (watermarkImage ?? undefined) : undefined,
  };
  const forcedOnchain = !!doc.embeddedRequest;
  // "On-chain" applies equally to single and multi signing — the only
  // difference downstream is whether the co-signer address list is shown.
  const onchainMode = onchain || forcedOnchain;

  /*
   * Co-signing a certificate that points at an ON-LEDGER request.
   *
   * The signature that counts for such a document is the NFT minted into the
   * signer's own collection: the verifier re-finds it through the chain of
   * custody and reports the document as unsigned without it. So the account
   * about to sign needs its seal AND its collection BEFORE the wallet is
   * opened. It used to be checked after signing and silently skipped when
   * missing, which produced the worst possible outcome: the wallet asked for a
   * ROLA proof, the PDF came out with the signature printed on its last page,
   * and the verify tab then said the document was not signed.
   *
   * The acting account is resolved the same way the on-ledger panel does it:
   * whichever connected account the certificate requires (any of them when the
   * set is open).
   */
  const cosignRequest = coSignMode ? (loadedCert!.request ?? null) : null;
  const cosignRequired = coSignMode ? loadedCert!.payload.signers : [];
  // The accounts that could sign this document from this wallet: the invited
  // ones it holds (all of them when the request is open).
  const cosignCandidates = accounts
    .map((a) => a.address)
    .filter((a) => cosignRequired.length === 0 || cosignRequired.includes(a))
    // Each candidate costs a ledger scan. A request always names its signers,
    // so this only bites on an open one shared with a many-account wallet.
    .slice(0, 8);
  // Asked of EVERY candidate, because the collection is per account: a wallet
  // whose other accounts have collections does not help the invited address
  // that has none, and that address is the only one whose signature counts.
  const cosignEligible = useSealSetups(cosignCandidates, !!cosignRequest);
  /**
   * The account the setup box works on: one that can already sign if there is
   * one, otherwise the account that has to create its collection — the one the
   * wallet just signed with, when it turned out to be a different one.
   */
  const cosignAccount =
    blockedAccount ?? cosignEligible.ready[0] ?? cosignCandidates[0] ?? null;
  const cosignSetup = useSealSetup(cosignRequest ? cosignAccount : null);
  /** No invited account in this wallet can record a signature yet. */
  const cosignNeedsSetup =
    !!cosignRequest &&
    !!cosignAccount &&
    cosignEligible.resolved &&
    cosignEligible.ready.length === 0;

  // "Signature only" is the ABSENCE of the other two, not a third switch to
  // tick alongside them — see lib/identity-options for the rule.
  const identityValue = identitySelection({ disclosure, includeEmail });
  const onIdentityChange = (next: IdentityOpt[]) => {
    const choice = nextIdentityChoice({ disclosure, includeEmail }, next);
    setDisclosure(choice.disclosure);
    setIncludeEmail(choice.includeEmail);
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
      // Record the certificate on this signer's entry so it survives co-signing.
      finalRes = padesActive ? withSignerCertificate(res, padesCert) : res;
    }

    const requestSigners = resolveRequestSigners(
      onchainAccount,
      cleanCoSigners,
      !sendOnly,
    );

    // Multi on-ledger: issue the invitation NFTs (permission) and, when the
    // initiator also signs, mint their own record NFT in the same transaction.
    // The request key is stored in the certificate so co-signers know where to
    // mint their records.
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
      // NOTHING is produced when the ledger did not accept it. The document is
      // signed on-ledger or it is not, and handing over a certificate — or a
      // PDF whose last page reads "signed" — for a transaction that failed
      // states as fact something the ledger will contradict. The error is
      // already on screen; the signer retries.
      if (!created) return;
      // The date the certificate prints must be the date the transaction was
      // committed — the one a reader finds when they open the txid. The wallet
      // signature carries a timestamp-authority time seconds earlier, and
      // printing that left the page and the ledger disagreeing about when the
      // document was signed.
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
          // The initiator's own signature was minted in that same transaction,
          // so it is the transaction that recorded it — and `signatureNft` is
          // the token it minted, which the certificate page prints.
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

  const onSimulateInvite = async () => {
    if (!docHash || activeNetworkId == null || !setup.seal || !setup.collection || !onchainAccount)
      return;
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

  // Preview the single on-ledger signature: the record NFT minted into the
  // signer's own Seal collection (the SAME manifest handleSign mints inline
  // when on-chain is selected without co-signers).
  const onSimulateSign = async () => {
    if (!docHash || activeNetworkId == null || !onchainAccount || !setup.seal || !setup.collection)
      return;
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

  // Preview the signature a co-signer is about to mint into their own
  // collection — the very manifest handleCoSign sends after the ROLA proof.
  const onSimulateCoSign = async () => {
    if (!cosignRequest || !cosignAccount || !cosignSetup.seal || !cosignSetup.collection)
      return;
    invitePreview.simulate(
      buildSignatureMintManifest({
        issuedAt: await fetchLedgerNow(cosignRequest.networkId),
        account: cosignAccount,
        sealGlobalId: cosignSetup.seal.globalId,
        collection: cosignSetup.collection.resourceAddress,
        nextId: cosignSetup.collection.totalSupply + 1,
        docHash: loadedCert!.payload.docHash,
        networkId: cosignRequest.networkId,
        request: cosignRequest.requestId,
        imageUrl: sealImageUrl(window.location.origin),
      }),
    );
  };

  const handleCoSign = async () => {
    if (!coSignBytes || !file || !loadedCert || cosignNeedsSetup) return;
    setSetupError('');
    setBlockedAccount(null);
    const signed = await coSign(loadedCert, coSignBytes, file.name, file.type);
    if (!signed) return;
    // This co-signer's own certificate, recorded alongside the earlier ones.
    let res = padesActive ? withSignerCertificate(signed, padesCert) : signed;

    // On-ledger multi: the co-signer's signature is ROLA (above); we also mint
    // their OWN signature NFT (record) into their Seal collection — for a
    // document signed on the ledger that NFT is the signature, so without it
    // there is nothing to hand over.
    const request = loadedCert.request;
    const cosigner =
      res.envelope.signatures[res.envelope.signatures.length - 1]?.signerAccount;
    if (request && cosigner) {
      const { seal, collection } = await findSealAndCollection(
        request.networkId,
        cosigner,
      );
      if (!seal || !collection) {
        // The wallet signed with an account that has no collection of its own.
        // The gate before the button watches the invited accounts this wallet
        // holds, but the signer chooses inside the wallet and may pick another
        // one. Nothing is delivered: a certificate whose signature the ledger
        // does not carry verifies as unsigned. The account is remembered so the
        // setup box below is offered for it.
        setBlockedAccount(cosigner);
        setSetupError('seal_required');
        return;
      }
      {
        // The manifest names this id, so a committed transaction is proof the
        // signature NFT is exactly this one — worth recording, because it is
        // the evidence the certificate points a reader at.
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
        // The mint was attempted and the ledger refused it: hand over nothing.
        // A certificate whose signature has no on-ledger record, for a document
        // that is signed ON the ledger, is a document that is not signed.
        if (!txId) return;
        // Same clock as the txid printed beside it (see handleSign).
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
    }

    setResult(res);
    // Deliver the SAME artifacts as a first signature (signed PDF included):
    // the co-signer had to download the JSON and rebuild the PDF by hand before.
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
    coSignMode && !!coSignHash && coSignHash !== loadedCert!.payload.docHash;

  // One-time on-ledger setup, ALONE on screen until completed — nothing
  // else competes for attention. Co-signers arriving via a shared request
  // are exempt (they get a compact inline checklist instead).
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

  // Hidden once the document already carries one (see `inheritedWatermark`).
  const watermarkBox = pdfOk && !inheritedWatermark && (
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

  // Certificate signing makes sense for any PDF — including when co-signing,
  // where each signer may add their own certificate.
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
      {coSignMode ? (
        <SignCoSignView
          t={t}
          consoleT={consoleT}
          cosignBox={cosignBox}
          loadedCert={loadedCert!}
          hashMismatch={hashMismatch}
          failure={failure}
          watermarkBox={watermarkBox}
          padesBox={padesBox}
          coSignComplete={coSignComplete}
          onDownloadSigned={() => void downloadSignedDoc()}
          showOnboarding={cosignNeedsSetup || (!!blockedAccount && !!setupError)}
          cosignAccount={cosignAccount}
          cosignSetup={cosignSetup}
          hasCosignRequest={!!cosignRequest}
          canCoSign={
            !!coSignBytes &&
            !hashMismatch &&
            !busy &&
            !padesBlocking &&
            !cosignNeedsSetup &&
            !(
              !!cosignRequest &&
              cosignCandidates.length > 0 &&
              !cosignEligible.resolved
            )
          }
          busy={busy}
          onCoSign={handleCoSign}
          onSimulateCoSign={onSimulateCoSign}
          canSimulate={!busy && !cosignNeedsSetup && !!cosignSetup.collection}
          preview={invitePreview}
        />
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
            outputs={effectiveOutputs}
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

          <div className={onchainMode ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
            <button
              type="button"
              // Signing on-ledger with several people needs the seal and the
              // collection to mint the invitations into. The onboarding above
              // normally guarantees both; without them the wallet must not be
              // opened at all, or the signer signs for a request that cannot
              // be created.
              disabled={
                !docHash ||
                hashing ||
                busy ||
                padesBlocking ||
                (multiLedger && (!setup.seal || !setup.collection || !onchainAccount))
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
