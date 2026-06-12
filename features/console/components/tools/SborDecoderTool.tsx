'use client';

import { useState } from 'react';
import { Braces } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { CopyButton } from '@/components/ui/CopyButton';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { TextAreaField } from '../shared/fields';
import { ManifestCode } from '../shared/ManifestCode';

interface DecodeResult {
  kind: 'scrypto' | 'manifest';
  decoded: string;
}

/** Universal SBOR decoder: paste any hex payload, see it human-readable. */
export default function SborDecoderTool({ t }: ConsoleToolProps) {
  const labels = t.sborDecoder;
  const { activeNetwork } = useRadixWallet();

  const [hex, setHex] = useState('');
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [hasError, setHasError] = useState(false);

  const cleanHex = hex.replace(/\s+/g, '').replace(/^0x/i, '');

  const handleDecode = async () => {
    setResult(null);
    setHasError(false);
    setIsDecoding(true);
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
    } catch {
      setHasError(true);
    } finally {
      setIsDecoding(false);
    }
  };

  return (
    <div className="space-y-5">
      <ToolSection title={labels.inputLabel} hint={labels.hint}>
        <TextAreaField
          value={hex}
          onChange={setHex}
          placeholder={labels.placeholder}
          rows={6}
          mono
          error={hasError ? labels.error : undefined}
        />
        <button
          type="button"
          onClick={handleDecode}
          disabled={!cleanHex || isDecoding}
          title={labels.buttonHint}
          className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isDecoding ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <Braces className="size-4" />
          )}
          {labels.button}
        </button>
      </ToolSection>

      {result && (
        <ToolSection
          title={result.kind === 'manifest' ? labels.resultManifest : labels.resultScrypto}
          action={<CopyButton value={result.decoded} size="xs" variant="ghost" label={t.common.copy} />}
        >
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
        </ToolSection>
      )}
    </div>
  );
}
