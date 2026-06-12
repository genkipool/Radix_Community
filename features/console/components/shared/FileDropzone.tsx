'use client';

import { useRef, useState, DragEvent } from 'react';
import { FileUp, X } from 'lucide-react';

interface FileDropzoneProps {
  /** Accepted file extension, including the dot (e.g. ".wasm") */
  extension: string;
  label: string;
  prompt: string;
  file: File | null;
  onFile: (file: File | null) => void;
  busy?: boolean;
  error?: string;
  disabled?: boolean;
}

const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

/** Drag & drop single-file input used by the deploy-package tool. */
export function FileDropzone({
  extension,
  label,
  prompt,
  file,
  onFile,
  busy = false,
  error,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(extension)) return;
    onFile(candidate);
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled) acceptFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className="w-full rounded-2xl border-2 border-dashed p-6 flex flex-col items-center gap-2 text-center transition-colors cursor-pointer disabled:opacity-50"
        style={{
          borderColor: isDragOver || file ? 'var(--color-primary)' : 'var(--color-card-border)',
          background: isDragOver ? 'rgba(var(--color-primary-rgb), 0.06)' : 'var(--color-surface)',
        }}
      >
        <FileUp
          className="size-6"
          style={{ color: file ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
        />
        {file ? (
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
            {busy ? (
              <span className="size-3.5 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
            ) : null}
            {file.name}
            <span className="text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>
              {formatSize(file.size)}
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-label={`Remove ${file.name}`}
              onClick={(e) => { e.stopPropagation(); onFile(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onFile(null);
                }
              }}
              className="p-1 rounded-full transition-colors hover:bg-red-500/10 hover:text-red-500"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X className="size-3.5" />
            </span>
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{prompt}</span>
        )}
      </button>
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={extension}
        className="hidden"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
