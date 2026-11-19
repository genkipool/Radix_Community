'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2, Terminal } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { computeFileSha256, findDocumentBySha256 } from '../lib/pdfHash';
import type { DaoCopy, DaoDocument } from '../types/radixDao.types';
import { VerificationResultBanner } from './VerificationResultBanner';

interface PdfHashVerifierProps {
  verify: DaoCopy['verify'];
  docItems: DaoCopy['documents']['items'];
}

interface VerificationState {
  status: 'idle' | 'computing' | 'match' | 'mismatch';
  fileName?: string;
  hash?: string;
  matchedDoc?: DaoDocument;
}

const CLI_COMMANDS = [
  { os: 'Linux', cmd: 'sha256sum document.pdf' },
  { os: 'macOS', cmd: 'shasum -a 256 document.pdf' },
  { os: 'Windows', cmd: 'Get-FileHash -Algorithm SHA256 document.pdf' },
] as const;

export function PdfHashVerifier({ verify, docItems }: PdfHashVerifierProps) {
  const [state, setState] = useState<VerificationState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setState({ status: 'computing', fileName: file.name });
    try {
      const hash = await computeFileSha256(file);
      const matchedDoc = findDocumentBySha256(hash);
      if (matchedDoc) {
        setState({ status: 'match', fileName: file.name, hash, matchedDoc });
      } else {
        setState({ status: 'mismatch', fileName: file.name, hash });
      }
    } catch {
      setState({ status: 'idle' });
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const matchedTitle = state.matchedDoc
    ? docItems[state.matchedDoc.id as keyof typeof docItems]?.title ?? state.matchedDoc.fileName
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-[var(--color-text-main)]">
          {verify.checkerTitle}
        </h3>
        <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-1 leading-relaxed max-w-3xl">
          {verify.checkerDesc}
        </p>
      </div>

      {/* Balanced 2-column split: Drop Zone (7 cols) | Terminal CLI Commands (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer min-h-[190px] ${
              isDragging
                ? 'border-[var(--color-secondary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-card-border)] bg-[var(--color-surface)]/60 hover:border-[var(--color-secondary)]/50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={onInputChange}
              className="sr-only"
              aria-label={verify.checkerDropCta}
            />

            {state.status === 'computing' ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-7 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[var(--color-text-main)]">
                  {verify.checkerComputing}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="size-7 text-[var(--color-secondary)]" aria-hidden="true" />
                <p className="text-sm sm:text-base font-bold text-[var(--color-text-main)]">
                  {verify.checkerDropCta}
                </p>
                <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                  {verify.checkerHint}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CLI Commands aligned to match drop zone height */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-3">
          <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <Terminal className="size-3.5 text-[var(--color-secondary)]" aria-hidden="true" />
            <span>{verify.cliTitle}</span>
          </h4>
          <div className="flex-1 flex flex-col justify-between gap-2.5">
            {CLI_COMMANDS.map((item) => (
              <div
                key={item.os}
                className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl px-4 py-3 font-mono text-xs sm:text-sm text-[var(--color-text-main)] flex items-center justify-between gap-4"
              >
                <div className="min-w-0 truncate">
                  <span className="text-[var(--color-text-muted)] mr-2">{item.os}:</span>
                  <span className="select-all">{item.cmd}</span>
                </div>
                <CopyButton value={item.cmd} variant="ghost" size="xs" className="shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Result Banner — full width below when active */}
      {(state.status === 'match' || state.status === 'mismatch') && state.hash && state.fileName && (
        <VerificationResultBanner
          status={state.status}
          fileName={state.fileName}
          hash={state.hash}
          matchedTitle={matchedTitle}
          matchedFileName={state.matchedDoc?.fileName}
          verify={verify}
          onReset={() => setState({ status: 'idle' })}
        />
      )}
    </div>
  );
}
