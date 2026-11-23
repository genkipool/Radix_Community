'use client';

import { useState } from 'react';
import { FileCode2 } from 'lucide-react';
import { ManifestCode } from './ManifestCode';
import { CopyButton } from '@/components/ui/CopyButton';

interface CollapsibleManifestProps {
  manifest: string;
  showLabel: string;
  hideLabel: string;
  copyLabel: string;
}

export function CollapsibleManifest({
  manifest,
  showLabel,
  hideLabel,
  copyLabel,
}: CollapsibleManifestProps) {
  const [showManifest, setShowManifest] = useState(false);
  const isDisabled = !manifest.trim();
  const isOpen = showManifest && !isDisabled;

  return (
    <div className="w-full">
      <div className="flex justify-end mt-2 mb-2">
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => setShowManifest((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity cursor-pointer hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <FileCode2 className="size-4" />
          {isOpen ? hideLabel : showLabel}
        </button>
      </div>

      {isOpen && (
        <div
          className="rounded-2xl border p-4 overflow-x-auto relative mb-4 shadow-inner"
          style={{ borderColor: 'var(--color-card-border)', background: 'var(--code-bg)' }}
        >
          <div className="absolute top-2 right-2">
            <CopyButton value={manifest} variant="ghost" size="xs" title={copyLabel} />
          </div>
          <ManifestCode code={manifest} className="mt-4 sm:mt-0" />
        </div>
      )}
    </div>
  );
}
