'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileSignature,
  RotateCcw,
  TriangleAlert,
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
import { useSealRequest, useSealSetup, useSealSetups } from '../hooks/useSealRequest';
import { findSealAndCollection } from '../services/sealDiscovery';
import type { DocumentFile } from '../hooks/useDocumentFile';
import { OnChainSignPanel } from './OnChainSignPanel';
import { ShareLinkSection } from './ShareLinkSection';
import { RequestTransactionLinks } from './RequestTransactionLinks';
import { SealOnboarding } from './SealOnboarding';
import { SignErrorText } from './SignErrorText';
import { stripExtension } from '../lib/file';
import { downloadBytes, downloadCertificate } from '../lib/certificate';
import { signaturePageOptions } from '../lib/pdf-signature-page';
import { buildDeliverablePdf } from '../lib/signed-pdf';
import { readP12Info, type P12Info } from '../lib/pdf-pades';
import {
  PadesSignSection,
  emptyPadesConfig,
  type PadesConfig,
  type PadesStatus,
} from './PadesSignSection';
import type { WatermarkKind, WatermarkOptions } from '../lib/pdf-watermark';
import {
  buildSignCollectionCreateManifest,
  buildSignRequestManifest,
  buildSignatureMintManifest,
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
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import { explorerTxUrl } from '../lib/explorer';
import type { SignDictionary } from '../types/dictionary';
import type {
  AttestationEnvelope,
  DisclosurePolicy,
  OutputFormat,
  SignResult,
} from '../types/sign.types';

type IdentityOpt = IdentityOption;

const isPdfResult = (r: { fileType: string; fileName: string }) =>
  r.fileType === 'application/pdf' || r.fileName.toLowerCase().endsWith('.pdf');

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

/** Maps a PAdES/p12 signing failure to a dictionary error code. */
function padesErrorCode(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /mac|password|pkcs12|invalid|decrypt/.test(msg)
    ? 'wrong_password'
    : 'generic';
}



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

/** True when every required signer has signed (open certificates need one). */
export function envelopeComplete(env: AttestationEnvelope): boolean {
  const required = env.payload.signers;
  const signed = new Set(env.signatures.map((s) => s.signerAccount));
  return required.length === 0 ? signed.size > 0 : required.every((a) => signed.has(a));
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
  // Optional PAdES / X.509 certificate signing (advanced, PDF output only).
  const [pades, setPades] = useState<PadesConfig>(emptyPadesConfig);
  const [padesError, setPadesError] = useState('');
  const [padesStatus, setPadesStatus] = useState<PadesStatus>('idle');
  // Separate from `padesStatus` so a re-check never clears the current verdict.
  const [padesChecking, setPadesChecking] = useState(false);
  // Certificate identity from the validated .p12, printed on the visible page.
  const [padesCert, setPadesCert] = useState<P12Info | null>(null);
  /**
   * On-ledger prerequisite the signing account turned out to be missing. It
   * cannot come from a hook's error state: it is decided here, between the
   * wallet's proof and the mint.
   */
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
    envelopeComplete(loadedCert!);
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

  // Validate the PAdES certificate + password the moment both are present, so
  // signing is blocked (and an error shown) BEFORE the wallet signs — never
  // after. Debounced so it does not run on every keystroke. All state updates
  // happen inside the timer (never synchronously in the effect body).
  useEffect(() => {
    let cancelled = false;
    const file = pades.file;
    const password = pades.password;
    const ready = pades.enabled && !!file && !!password;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (!ready || !file) {
        setPadesStatus('idle');
        setPadesError('');
        setPadesCert(null);
        return;
      }
      // Only the spinner flag changes here: the previous verdict (and its
      // message) STAYS on screen while re-checking, so typing never makes the
      // error box disappear and reappear (which shifted the page and flickered).
      setPadesChecking(true);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        // Reading the identity IS the validation: null means wrong password or
        // an unreadable file, and the details feed the visible page.
        const info = await readP12Info(bytes, password);
        if (cancelled) return;
        setPadesCert(info);
        setPadesStatus(info ? 'valid' : 'invalid');
        setPadesError(info ? '' : 'wrong_password');
      } catch {
        if (cancelled) return;
        setPadesCert(null);
        setPadesStatus('invalid');
        setPadesError('wrong_password');
      } finally {
        if (!cancelled) setPadesChecking(false);
      }
    }, ready ? 400 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pades.enabled, pades.file, pades.password]);

  // Certificate signing applies to any PDF (every PDF now gets a signed PDF
  // artifact). It blocks signing until the certificate is verified, so a bad
  // password can never reach the wallet step.
  const padesActive = pades.enabled && pdfOk;
  const padesBlocking = padesActive && padesStatus !== 'valid';

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
    let delivered = false;
    if (chosen.includes('embedded') && isPdfResult(res)) {
      try {
        setPadesError('');
        const pdf = await buildDeliverablePdf({
          fileBytes: res.fileBytes,
          envelope: res.envelope,
          watermark: watermarkOptions,
          pageOptions: await signaturePageOptions(
            res.envelope,
            t,
            language,
            padesActive,
          ),
          pades: padesActive ? pades : null,
        });
        downloadBytes(
          pdf,
          `${stripExtension(res.fileName)}-signed.pdf`,
          'application/pdf',
        );
        delivered = true;
      } catch (err) {
        // A certificate failure must surface, never silently hand over a PDF
        // missing the requested signature; other failures fall back to the JSON.
        if (padesActive) {
          setPadesError(padesErrorCode(err));
          return;
        }
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
      // Record the certificate on this signer's entry so it survives co-signing.
      finalRes = padesActive ? withSignerCertificate(res, padesCert) : res;
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
          // so it is the transaction that recorded it.
          signatures: finalRes.envelope.signatures.map((entry) =>
            entry.signerAccount === onchainAccount && !sendOnly
              ? {
                  ...entry,
                  transactionIntentHash: created.transactionIntentHash,
                  signedAt: committedAt ?? entry.signedAt,
                }
              : entry,
          ),
        },
      };
    }

    setResult(finalRes);
    await deliver(finalRes, effectiveOutputs);
  };

  // Preview the invitation transaction (multi on-ledger).
  const onSimulateInvite = async () => {
    if (!docHash || activeNetworkId == null || !setup.seal || !setup.collection || !onchainAccount)
      return;
    const cleanCoSigners = coSigners.map((s) => s.trim()).filter(Boolean);
    if (cleanCoSigners.length === 0) return;
    invitePreview.simulate(
      buildSignRequestManifest({
        issuedAt: await fetchLedgerNow(activeNetworkId),
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
        const txId = await signRequest({
          account: cosigner,
          sealGlobalId: seal.globalId,
          collection: collection.resourceAddress,
          nextId: collection.totalSupply + 1,
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

  // Deliver the already-complete certificate as a signed artifact: for a PDF,
  // the original with the certificate embedded (verifies on its own); otherwise
  // the detached certificate JSON.
  const downloadSignedDoc = async () => {
    if (!loadedCert) return;
    const isPdf =
      !!file &&
      (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (isPdf && coSignBytes) {
      try {
        setPadesError('');
        const pdf = await buildDeliverablePdf({
          fileBytes: coSignBytes,
          envelope: loadedCert,
          watermark: watermarkOptions,
          pageOptions: await signaturePageOptions(
            loadedCert,
            t,
            language,
            padesActive,
          ),
          pades: padesActive ? pades : null,
        });
        downloadBytes(pdf, `${stripExtension(file.name)}-signed.pdf`, 'application/pdf');
        return;
      } catch (err) {
        if (padesActive) {
          setPadesError(padesErrorCode(err));
          return;
        }
        // Fall back to the detached certificate below.
      }
    }
    downloadCertificate(loadedCert);
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
    <ToolSection title={t.options.outputTitle} hint={t.options.outputHint}>
      <OptionButtons<OutputFormat>
        multiple
        value={effectiveOutputs}
        onChange={(v) => {
          // At least one output format must stay selected.
          if (v.length === 0) return;
          setOutputsPicked(true);
          setOutputs(v);
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

  // Hidden once the document already carries one (see `inheritedWatermark`).
  const watermarkBox = pdfOk && !inheritedWatermark && (
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
          {/* A co-signer gets the same PDF options as the initiator: their own
              watermark and, above all, their OWN certificate. */}
          {watermarkBox}
          {padesBox}
          {coSignComplete ? (
            // Everyone required has already signed: no signature to add, just
            // hand over the finished signed document.
            <button
              type="button"
              onClick={() => void downloadSignedDoc()}
              className="flex w-full items-center justify-center gap-2.5 px-7 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow-md transition-all hover:opacity-90 active:scale-95"
            >
              <Download className="size-4" />
              {t.actions.downloadSigned}
            </button>
          ) : (
            <>
              {/* An invited account with no collection cannot record anything
                  on the ledger, so it must not be asked for a signature: it
                  would get a certificate the verifier reads as unsigned. Say
                  which account is missing what, and offer the one-time setup
                  right here.

                  Shown both when NO invited account of this wallet can sign and
                  when the signer picked, inside the wallet, an invited account
                  that cannot — the button stays live in that second case, since
                  another of their accounts still can. */}
              {(cosignNeedsSetup || (!!blockedAccount && !!setupError)) &&
                cosignAccount && (
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
                      {/* The address is a line of its own: it is the one piece
                          the reader has to compare against their wallet, and
                          inside a paragraph it was unreadable. */}
                      {t.cosign.needsCollection
                        .split('{account}')
                        .map((part, i) => (
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
                  cosignRequest ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''
                }
              >
                <button
                  type="button"
                  disabled={
                    !coSignBytes ||
                    hashMismatch ||
                    busy ||
                    padesBlocking ||
                    cosignNeedsSetup ||
                    // Held shut while the ledger is still being asked whether
                    // the invited account can record a signature at all.
                    (!!cosignRequest &&
                      cosignCandidates.length > 0 &&
                      !cosignEligible.resolved)
                  }
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
                {/* Co-signing an on-ledger certificate mints a signature NFT,
                    so it gets the same dry run as every other transaction. */}
                {cosignRequest && (
                  <SimulateButton
                    t={consoleT.simulate}
                    onClick={onSimulateCoSign}
                    disabled={busy || cosignNeedsSetup || !cosignSetup.collection}
                    loading={invitePreview.isSimulating}
                  />
                )}
              </div>
              {cosignRequest && (
                <SimulateResultCard
                  t={consoleT.simulate}
                  preview={invitePreview.preview}
                  error={invitePreview.error}
                  onClose={invitePreview.reset}
                />
              )}
            </>
          )}
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
                  categories={['account']}
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
  pades,
  watermark,
  padesError,
  onPadesError,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  result: SignResult;
  outputs: OutputFormat[];
  onReset: () => void;
  /** Basic mode hides the on-ledger anchoring option entirely. */
  allowAnchor?: boolean;
  /** PAdES/X.509 config lifted from the form, so downloads keep the cert. */
  pades?: PadesConfig | null;
  /** Watermark lifted from the form, so downloads keep it too. */
  watermark?: WatermarkOptions;
  padesError?: string;
  onPadesError?: (code: string) => void;
}) {
  const [envelope, setEnvelope] = useState<AttestationEnvelope>(result.envelope);
  const { anchor, phase, error } = useDocumentSign();
  const preview = useTransactionPreview();
  const { language } = useLanguage();
  const { activeNetworkId } = useRadixWallet();
  const anchoring = phase === 'anchoring';

  // Without an on-ledger request the share link still exists: it delivers the
  // signed artifact itself over the P2P channel. For PDFs that is the signed
  // PDF (certificate embedded), so the receiver can verify or co-sign from
  // one file; otherwise the original document travels as-is.
  const [shareArtifact, setShareArtifact] = useState<{
    bytes: Uint8Array;
    name: string;
    type: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (isPdfResult(result)) {
        try {
          // The shared artifact is the SAME file the download button produces:
          // watermark, visible page, attachments and certificate signature.
          const pdf = await buildDeliverablePdf({
            fileBytes: result.fileBytes,
            envelope,
            watermark,
            pageOptions: await signaturePageOptions(
              envelope,
              t,
              language,
              !!pades?.enabled,
            ),
            pades,
          });
          if (!cancelled) {
            setShareArtifact({
              bytes: pdf,
              name: `${stripExtension(result.fileName)}-signed.pdf`,
              type: 'application/pdf',
            });
          }
          return;
        } catch {
          // Fall back to sharing the original document below.
        }
      }
      if (!cancelled) {
        setShareArtifact({
          bytes: result.fileBytes,
          name: result.fileName,
          type: result.fileType,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelope, result, language, t, pades, watermark]);

  const { payload } = envelope;
  /** The signature this session just produced (the last one appended). */
  const lastSignature = envelope.signatures[envelope.signatures.length - 1];
  const padesErrorMsg = padesError
    ? (t.pades.errors as Record<string, string>)[padesError] ?? t.pades.errors.generic
    : '';
  // Always offer BOTH artifacts: the signed PDF is the self-contained one and
  // the JSON travels to other tools, so hiding either only costs the user a
  // round trip through the options.
  const pdfBtn = isPdfResult(result);
  const certBtn = true;

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

  const onSimulate = async () => {
    if (!anchorAccount || activeNetworkId == null || !setup.seal) return;
    const imageUrl = sealImageUrl(window.location.origin);
    // Preview the SAME manifest the anchor will submit: a stand-alone signature
    // (`request=''`) minted into the signer's Seal-owned collection (model 1).
    const issuedAt = await fetchLedgerNow(activeNetworkId);
    const manifest = setup.collection
      ? buildSignatureMintManifest({
          issuedAt,
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
      onPadesError?.('');
      // Identical pipeline to the auto-download and the shared artifact, so the
      // watermark and the certificate signature are never silently dropped.
      const pdf = await buildDeliverablePdf({
        fileBytes: result.fileBytes,
        envelope,
        watermark,
        pageOptions: await signaturePageOptions(
          envelope,
          t,
          language,
          !!pades?.enabled,
        ),
        pades,
      });
      downloadBytes(
        pdf,
        `${stripExtension(result.fileName)}-signed.pdf`,
        'application/pdf',
      );
    } catch (err) {
      if (pades?.enabled) {
        onPadesError?.(padesErrorCode(err));
        return;
      }
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
          {/* What the wallet actually disclosed for the signature just made —
              the same text the certificate page prints. Shown here because a
              certificate is read long after the wallet prompt, and "the name
              is not the one I expected" is otherwise only discoverable by
              opening the PDF. */}
          {lastSignature?.disclosedName && (
            <Row label={t.result.name} value={lastSignature.disclosedName} />
          )}
          {lastSignature?.disclosedEmail && (
            <Row label={t.result.email} value={lastSignature.disclosedEmail} />
          )}
        </dl>
        {payload.disclosure !== 'none' && !lastSignature?.disclosedName && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {t.result.nameMissing}
          </p>
        )}
      </ToolSection>

      <SignerProgress t={t} envelope={envelope} />

      {envelope.request && !complete ? (
        // Multi-party on-ledger, still missing signatures: the link co-signers
        // open to see the request and co-sign, with the direct document channel
        // available by default.
        //
        // Once the last signature lands there is nobody left to invite, so the
        // box below takes over and shares the finished document instead. It
        // used to keep offering "share this link with the signers" on a
        // document nobody could still sign.
        // It carries the SIGNED PDF once we have it (it holds the certificate,
        // the signatures so far and the intact original in one file, and the
        // receiver's dropzone recovers the original from it), falling back to
        // the plain document while it is still being built.
        <ShareLinkSection
          t={t}
          requestKey={envelope.request.requestId}
          docName={payload.fileName}
          fileName={shareArtifact?.name ?? result.fileName}
          fileType={shareArtifact?.type ?? result.fileType}
          bytes={shareArtifact?.bytes ?? result.fileBytes}
          outputs={outputs}
          networkId={envelope.request.networkId}
        >
          {/* The transaction that put this request on the ledger, beside the
              link that points at it. */}
          {envelope.request.transactionIntentHash && (
            <RequestTransactionLinks
              t={t}
              txId={envelope.request.transactionIntentHash}
              networkId={envelope.request.networkId}
            />
          )}
        </ShareLinkSection>
      ) : (
        shareArtifact && (
          // Every other signing still gets a share link + QR: it delivers the
          // signed artifact directly, browser to browser.
          <ShareLinkSection
            t={t}
            docName={shareArtifact.name}
            fileName={shareArtifact.name}
            fileType={shareArtifact.type}
            bytes={shareArtifact.bytes}
            outputs={outputs}
            networkId={payload.networkId}
            tab="sign"
            title={t.onchain.shareDocTitle}
            hint={t.onchain.shareDocHint}
          >
            {/* A completed on-ledger document still points at the transaction
                that opened it: the record does not stop being useful once the
                invitations are spent. */}
            {envelope.request?.transactionIntentHash && (
              <RequestTransactionLinks
                t={t}
                txId={envelope.request.transactionIntentHash}
                networkId={envelope.request.networkId}
              />
            )}
          </ShareLinkSection>
        )
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
          {error && (
            <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
              <SignErrorText t={t} code={error} />
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

      {padesErrorMsg && (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-danger, #dc2626)',
            color: 'var(--color-danger, #dc2626)',
          }}
        >
          {padesErrorMsg}
        </p>
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
