'use client';

import { useState } from 'react';
import { Braces, Code } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { CopyButton } from '@/components/ui/CopyButton';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { TextAreaField } from '../shared/fields';
import { ManifestCode } from '../shared/ManifestCode';

interface DecodeResult {
  kind: 'scrypto' | 'manifest' | 'hex';
  decoded: string;
}

/** Universal SBOR decoder: paste any hex payload, see it human-readable. */
export default function SborDecoderTool({ t }: ConsoleToolProps) {
  const labels = t.sborDecoder;
  const { activeNetwork } = useRadixWallet();

  const [hex, setHex] = useState('');
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const cleanHex = hex.trim();

  const handleDecode = async () => {
    setResult(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/ret/sbor-decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hex: cleanHex, network: activeNetwork }),
      });
      if (!res.ok) throw new Error('decode failed');
      const data = (await res.json()) as DecodeResult;
      // Pretty-print programmatic JSON for readability
      if (data.kind === 'scrypto') {
        try {
          data.decoded = JSON.stringify(JSON.parse(data.decoded), null, 2);
        } catch {
          /* keep raw */
        }
      }
      setResult(data);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEncode = async () => {
    setResult(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/ret/sbor-encode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: hex, network: activeNetwork }),
      });
      if (!res.ok) throw new Error('encode failed');
      const data = (await res.json()) as DecodeResult;
      setResult(data);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <header className="space-y-1">
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
            {labels.inputLabel}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.hint}
          </p>
        </header>
        <TextAreaField
          value={hex}
          onChange={setHex}
          placeholder={labels.placeholder}
          rows={6}
          mono
          error={hasError ? labels.error : undefined}
          hint={!hasError ? <span className="font-medium opacity-0 select-none pointer-events-none" aria-hidden="true">{labels.error}</span> : undefined}
        />
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={handleEncode}
            disabled={!cleanHex || isLoading}
            title={labels.encodeHint}
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isLoading ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Code className="size-4" />
            )}
            {labels.encodeButton}
          </button>
          
          <button
            type="button"
            onClick={handleDecode}
            disabled={!cleanHex || isLoading}
            title={labels.buttonHint}
            className="flex flex-1 items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isLoading ? (
              <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <Braces className="size-4" />
            )}
            {labels.button}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
          <header className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
                {result.kind === 'manifest' 
                  ? labels.resultManifest 
                  : result.kind === 'hex' 
                    ? labels.resultHex 
                    : labels.resultScrypto}
              </h3>
              <CopyButton value={result.decoded} size="xs" variant="ghost" label={t.common.copy} />
            </div>
          </header>
          {result.kind === 'manifest' ? (
            <ManifestCode code={result.decoded} />
          ) : (
            <pre
              className="m-0 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto"
              style={{ color: 'var(--color-text-main)' }}
            >
              {result.decoded}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
