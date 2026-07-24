'use client';

import { useState } from 'react';
import { FileSignature } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { useDocumentSign } from '../hooks/useDocumentSign';
import type { DocumentFile } from '../hooks/useDocumentFile';
import { looksLikeEnvelope, ResultPanel } from './SignForm';
import { useLanguage } from '@/context/LanguageContext';
import { stripExtension } from '../lib/file';
import { downloadBytes, downloadCertificate } from '../lib/certificate';
import { embedCertificateInPdf } from '../lib/pdf-embed';
import { signaturePageOptions } from '../lib/pdf-signature-page';
import type { SignDictionary } from '../types/dictionary';
import type {
  AttestationEnvelope,
  OutputFormat,
  SignResult,
} from '../types/sign.types';

const isPdfResult = (r: { fileType: string; fileName: string }) =>
  r.fileType === 'application/pdf' || r.fileName.toLowerCase().endsWith('.pdf');

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
  const [result, setResult] = useState<SignResult | null>(null);

  const { sign, coSign, phase, error, reset } = useDocumentSign();
  const { language } = useLanguage();
  const busy = phase === 'signing' || phase === 'anchoring';
  const coSignMode = !!loadedCert;

  // At least one output format must stay selected.
  const onOutputsChange = (v: OutputFormat[]) => {
    if (v.length > 0) setOutputs(v);
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
        // The original bytes are embedded intact so the PDF verifies alone.
        const pdf = await embedCertificateInPdf(
          res.fileBytes,
          res.envelope,
          res.fileBytes,
          await signaturePageOptions(res.envelope, t, language),
        );
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
      await deliver(res, outputs);
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
        outputs={outputs}
        onReset={startOver}
        allowAnchor={false}
      />
    );
  }

  const errorMsg = error
    ? ((t.errors as Record<string, string>)[error] ?? t.errors.generic)
    : '';
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

      <ToolSection title={t.options.outputTitle} hint={t.options.outputHint}>
        <OptionButtons<OutputFormat>
          multiple
          value={outputs}
          onChange={onOutputsChange}
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
