'use client';

import { useState } from 'react';
import { ArrowRight, Globe, Server } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import type { Network } from '@/services/gateway/client';
import { convertOlympiaAddress } from '../../services/retClient';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { OptionButtons } from '../shared/OptionButtons';
import { TextField } from '../shared/fields';

export default function ConvertOlympiaTool({ t }: ConsoleToolProps) {
  const labels = t.olympia;

  const [olympiaAddress, setOlympiaAddress] = useState('');
  const [network, setNetwork] = useState<Network>('mainnet');
  const [babylonAddress, setBabylonAddress] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleConvert = async () => {
    setBabylonAddress('');
    setHasError(false);
    setIsConverting(true);
    try {
      setBabylonAddress(await convertOlympiaAddress(olympiaAddress.trim(), network));
    } catch {
      setHasError(true);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <ToolSection>
      <TextField
        label={labels.inputLabel}
        value={olympiaAddress}
        onChange={setOlympiaAddress}
        placeholder={labels.placeholder}
        hint={labels.hint}
        error={hasError ? labels.error : undefined}
        disabled={isConverting}
      />

      <OptionButtons
        options={[
          { value: 'mainnet', label: 'Mainnet', icon: <Globe className="size-4" /> },
          { value: 'stokenet', label: 'Stokenet', icon: <Server className="size-4" /> },
        ]}
        value={network}
        onChange={setNetwork}
        size="sm"
        disabled={isConverting}
      />

      <button
        type="button"
        onClick={handleConvert}
        disabled={!olympiaAddress.trim() || isConverting}
        className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
      >
        {isConverting ? (
          <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        ) : (
          <ArrowRight className="size-4" />
        )}
        {labels.convert}
      </button>

      {babylonAddress && (
        <div
          className="rounded-2xl border p-4 space-y-2"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
        >
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {labels.result}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs break-all font-mono" style={{ color: 'var(--color-text-main)' }}>
              {babylonAddress}
            </code>
            <CopyButton value={babylonAddress} size="xs" variant="ghost" />
          </div>
        </div>
      )}
    </ToolSection>
  );
}
