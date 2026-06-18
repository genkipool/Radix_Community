'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { convertOlympiaAddress } from '../../services/retClient';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { TextField } from '../shared/fields';

export default function ConvertOlympiaTool({ t }: ConsoleToolProps) {
  const labels = t.olympia;
  const { activeNetwork } = useRadixWallet();

  const [olympiaAddress, setOlympiaAddress] = useState('');
  const [babylonAddress, setBabylonAddress] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleConvert = async () => {
    setBabylonAddress('');
    setIsConverting(true);
    try {
      setBabylonAddress(await convertOlympiaAddress(olympiaAddress.trim(), activeNetwork));
      setHasError(false);
    } catch {
      setHasError(true);
    }
    setIsConverting(false);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <TextField
          label={labels.inputLabel}
          value={olympiaAddress}
          onChange={setOlympiaAddress}
          placeholder={labels.placeholder}
          hint={labels.hint}
          error={hasError ? labels.error : undefined}
          disabled={isConverting}
        />

        <button
          type="button"
          onClick={handleConvert}
          disabled={!olympiaAddress.trim() || isConverting}
          className="flex w-full items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isConverting ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {labels.convert}
        </button>
      </div>

      {babylonAddress && (
        <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
          <header className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
                {labels.result}
              </h3>
              <CopyButton value={babylonAddress} size="xs" variant="ghost" label={t.common.copy} />
            </div>
          </header>
          <code className="block p-4 rounded-xl text-xs break-all font-mono" style={{ background: 'var(--color-surface)', color: 'var(--color-text-main)' }}>
            {babylonAddress}
          </code>
        </div>
      )}
    </div>
  );
}
