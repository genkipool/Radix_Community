'use client';

import { useState } from 'react';
import { Download, Lock, RotateCcw, Share2 } from 'lucide-react';
import { FileDropzone } from '@/features/console/components/shared/FileDropzone';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import type { CipherDictionary } from '../types/dictionary';
import type { EncryptResult } from '../hooks/useEncryptFlow';
import { useEncryptFlow } from '../hooks/useEncryptFlow';
import { formatBytes } from '../lib/format';
import { TransferProgress } from './TransferProgress';

interface EncryptPanelProps {
  t: CipherDictionary;
  /** When provided, the result card offers sharing the file with a receiver. */
  onShare?: (result: EncryptResult) => void;
  /** Fired whenever the current result is discarded (new file / start over). */
  onReset?: () => void;
}

/** Encrypt tab body: pick a file, sign, stream-encrypt, download/share. */
export function EncryptPanel({ t, onShare, onReset }: EncryptPanelProps) {
  const flow = useEncryptFlow();
  const [file, setFile] = useState<File | null>(null);
  const busy = flow.phase === 'signing' || flow.phase === 'encrypting';

  const onFile = (candidate: File | null) => {
    if (busy) return;
    setFile(candidate);
    if (flow.phase !== 'idle') {
      onReset?.();
      void flow.reset();
    }
  };

  const restart = () => {
    setFile(null);
    onReset?.();
    void flow.reset();
  };

  return (
    <div className="space-y-6">
      <ToolSection>
        <FileDropzone
          extension=""
          label={t.file.label}
          prompt={t.file.prompt}
          file={file}
          onFile={onFile}
          busy={busy}
          disabled={busy || flow.phase === 'ready'}
        />

        {flow.phase === 'signing' && (
          <TransferProgress label={t.progress.signing} />
        )}
        {flow.phase === 'encrypting' && (
          <TransferProgress label={t.progress.encrypting} fraction={flow.progress} />
        )}

        {flow.error && (
          <p className="text-xs font-medium text-red-500">
            {t.errors[flow.error]}
          </p>
        )}

        {(flow.phase === 'idle' || flow.phase === 'error') && (
          <button
            type="button"
            disabled={!file}
            onClick={() => file && void flow.encrypt(file)}
            className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            <Lock className="size-4" />
            {t.encrypt.button}
          </button>
        )}
      </ToolSection>

      {flow.phase === 'ready' && flow.result && (
        <ToolSection title={t.encrypt.readyTitle} hint={t.encrypt.readyHint}>
          <p
            className="font-mono text-xs break-all"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {flow.result.encryptedName}
            {' · '}
            {formatBytes(flow.result.header.fileSize)}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void flow.download()}
              className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
            >
              <Download className="size-4" />
              {t.encrypt.download}
            </button>
            {onShare && (
              <button
                type="button"
                onClick={() => flow.result && onShare(flow.result)}
                className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm border transition-all hover:opacity-80 active:scale-95"
                style={{
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
              >
                <Share2 className="size-4" />
                {t.encrypt.share}
              </button>
            )}
            <button
              type="button"
              onClick={restart}
              className="flex items-center justify-center gap-2 px-5 h-11 rounded-full font-semibold text-sm transition-all hover:opacity-80 active:scale-95"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <RotateCcw className="size-4" />
              {t.encrypt.encryptAnother}
            </button>
          </div>
        </ToolSection>
      )}
    </div>
  );
}
