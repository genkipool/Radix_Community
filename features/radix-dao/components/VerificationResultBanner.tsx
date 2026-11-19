'use client';

import { CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import type { DaoCopy } from '../types/radixDao.types';

interface VerificationResultBannerProps {
  status: 'match' | 'mismatch';
  fileName: string;
  hash: string;
  matchedTitle?: string;
  matchedFileName?: string;
  verify: DaoCopy['verify'];
  onReset: () => void;
}

export function VerificationResultBanner({
  status,
  fileName,
  hash,
  matchedTitle,
  matchedFileName,
  verify,
  onReset,
}: VerificationResultBannerProps) {
  const isMatch = status === 'match';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-l-2 pl-5 py-2 space-y-3 ${
        isMatch ? 'border-[var(--color-accent)]' : 'border-[var(--color-danger)]'
      }`}
    >
      <div className="flex items-start gap-3">
        {isMatch ? (
          <CheckCircle2 className="size-5 shrink-0 text-[var(--color-accent)] mt-0.5" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-5 shrink-0 text-[var(--color-danger)] mt-0.5" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h4 className="text-base font-bold text-[var(--color-text-main)]">
            {isMatch ? verify.checkerMatchTitle : verify.checkerMismatchTitle}
          </h4>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            {isMatch ? verify.checkerMatchDesc : verify.checkerMismatchDesc}
          </p>
          {isMatch && matchedTitle && (
            <p className="text-sm font-bold text-[var(--color-primary)] pt-1">
              {matchedTitle} ({matchedFileName})
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl px-4 py-3">
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            {verify.checkerComputedHash} ({fileName})
          </span>
          <code className="block text-xs font-mono text-[var(--color-text-main)] break-all mt-0.5">
            {hash}
          </code>
        </div>
        <CopyButton value={hash} variant="ghost" size="xs" />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-secondary)] hover:underline cursor-pointer"
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        <span>{verify.checkerReset}</span>
      </button>
    </div>
  );
}
