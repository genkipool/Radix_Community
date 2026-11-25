'use client';

import { useState } from 'react';
import { FileSignature } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useLanguage } from '@/context/LanguageContext';
import { useDocumentSign } from '../hooks/useDocumentSign';
import type { DocumentFile } from '../hooks/useDocumentFile';
import { looksLikeEnvelope } from '../lib/certificate';
import { deliverSignedArtifacts } from '../lib/signed-pdf';
import { OutputFormatSection } from './SignDeliverySections';
import { SignErrorText } from './SignErrorText';
import { ResultPanel } from './SignResultPanel';
import type { SignDictionary } from '../types/dictionary';
import type {
  AttestationEnvelope,
  OutputFormat,
  SignResult,
} from '../types/sign.types';

/**
 * Minimal signing flow: drop a file (tool level), optionally load a
 * certificate to co-sign, pick the output format, sign. The wallet only
 * receives the ROLA proof challenge — no persona data, no message, no
 * co-signer list, and no on-ledger anchoring anywhere in this tab.
 */
export function BasicSignForm({
  t,
  consoleT,
  doc,
}: {
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  doc: DocumentFile;
}) {
  const { bytes, docHash, hashing, pdf: pdfOk } = doc;

  const [certFile, setCertFile] = useState<File | null>(null);
  const [loadedCert, setLoadedCert] = useState<AttestationEnvelope | null>(null);
  const [certError, setCertError] = useState('');
  const [outputs, setOutputs] = useState<OutputFormat[]>(['detached']);
  const [outputsPicked, setOutputsPicked] = useState(false);
  const [result, setResult] = useState<SignResult | null>(null);

  const { sign, coSign, phase, error, reset } = useDocumentSign();
  const { language } = useLanguage();
  const busy = phase === 'signing' || phase === 'anchoring';
  const coSignMode = !!loadedCert;

  const effectiveOutputs: OutputFormat[] =
    !outputsPicked && pdfOk
      ? [...new Set([...outputs, 'embedded' as const])]
      : outputs;

  const onOutputsChange = (v: OutputFormat[]) => {
    if (v.length === 0) return;
    setOutputsPicked(true);
    setOutputs(v);
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

  const handleSign = async () => {
    if (!bytes || !docHash || !doc.file) return;
    const res = coSignMode
      ? await coSign(loadedCert!, bytes, doc.file.name, doc.file.type)
      : await sign({
          fileBytes: bytes,
          docHash,
          fileName: doc.file.name,
          fileSize: doc.file.size,
          fileType: doc.file.type,
          message: '',
          disclosure: 'none',
          includeEmail: false,
          coSigners: [],
          onChain: false,
        });
    if (res) {
      setResult(res);
      await deliverSignedArtifacts({
        envelope: res.envelope,
        fileBytes: res.fileBytes,
        fileName: res.fileName,
        fileType: res.fileType,
        outputs: effectiveOutputs,
        t,
        locale: language,
      });
    }
  };

  const startOver = () => {
    setResult(null);
    doc.onFile(null);
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
        allowAnchor={false}
      />
    );
  }

  const hashMismatch =
    coSignMode && !!docHash && docHash !== loadedCert!.payload.docHash;

  return (
    <div className="space-y-5">
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

      <OutputFormatSection
        t={t}
        outputs={effectiveOutputs}
        pdfOk={pdfOk}
        busy={busy}
        onChange={onOutputsChange}
      />

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
      {error && (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-danger, #dc2626)',
            color: 'var(--color-danger, #dc2626)',
          }}
        >
          <SignErrorText t={t} code={error} />
        </p>
      )}

      <button
        type="button"
        disabled={!docHash || hashing || hashMismatch || busy}
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
          : coSignMode
            ? t.cosign.addSignature
            : t.actions.sign}
      </button>
    </div>
  );
}
