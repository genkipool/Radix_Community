'use client';

import { useState } from 'react';
import { BookMarked, CheckCircle2, KeyRound, ScanSearch, XCircle } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import { useKnownAddresses } from '../../hooks/useKnownAddresses';
import { inspectAddress, type AddressInspection } from '../../lib/address-inspect';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { OptionButtons } from '../shared/OptionButtons';
import { TextField } from '../shared/fields';

type Curve = 'ed25519' | 'secp256k1';

interface DerivedAddresses {
  accountAddress: string;
  identityAddress: string;
}

export default function AddressUtilsTool({ t }: ConsoleToolProps) {
  const labels = t.addressUtils;
  const { activeNetwork } = useRadixWallet();
  const { data: knownAddresses } = useKnownAddresses();

  /* ── Inspector ── */
  const [address, setAddress] = useState('');
  const inspection: AddressInspection | null = address.trim() ? inspectAddress(address) : null;

  /* ── Derivation ── */
  const [publicKeyHex, setPublicKeyHex] = useState('');
  const [curve, setCurve] = useState<Curve>('ed25519');
  const [derived, setDerived] = useState<DerivedAddresses | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);
  const [deriveError, setDeriveError] = useState(false);

  const handleDerive = async () => {
    setDerived(null);
    setDeriveError(false);
    setIsDeriving(true);
    try {
      const res = await fetch('/api/ret/derive-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKeyHex: publicKeyHex.trim(), curve, network: activeNetwork }),
      });
      if (!res.ok) throw new Error('derive failed');
      setDerived((await res.json()) as DerivedAddresses);
    } catch {
      setDeriveError(true);
    } finally {
      setIsDeriving(false);
    }
  };

  const entityLabels = labels.entityTypes as Record<string, string>;

  return (
    <div className="space-y-5">
      {/* Inspector */}
      <ToolSection title={labels.inspectTitle} hint={labels.inspectHint}>
        <TextField
          value={address}
          onChange={setAddress}
          placeholder={labels.inspectPlaceholder}
        />
        {inspection && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span className="inline-flex items-center gap-1.5" title={inspection.checksumValid ? labels.checksumOkHint : labels.checksumBadHint}>
              {inspection.checksumValid ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <XCircle className="size-4 text-red-500" />
              )}
              <span className="font-semibold" style={{ color: inspection.checksumValid ? '#10b981' : '#ef4444' }}>
                {inspection.checksumValid ? labels.checksumOk : labels.checksumBad}
              </span>
            </span>
            <span>
              {labels.entityType}:{' '}
              <span className="font-bold" style={{ color: 'var(--color-text-main)' }}>
                {entityLabels[inspection.entityType] ?? inspection.entityType}
              </span>
            </span>
            <span>
              {labels.network}:{' '}
              <span className="font-bold capitalize" style={{ color: 'var(--color-text-main)' }}>
                {inspection.network}
              </span>
            </span>
            <code style={{ color: 'var(--color-text-muted)' }}>hrp: {inspection.hrp}</code>
          </div>
        )}
      </ToolSection>

      {/* Derive from public key */}
      <ToolSection title={labels.deriveTitle} hint={labels.deriveHint}>
        <TextField
          label={labels.publicKey}
          value={publicKeyHex}
          onChange={setPublicKeyHex}
          placeholder={labels.publicKeyPlaceholder}
          error={deriveError ? labels.deriveError : undefined}
        />
        <div className="flex flex-wrap items-center gap-3">
          <OptionButtons<Curve>
            options={[
              { value: 'ed25519', label: 'Ed25519', title: labels.ed25519Hint },
              { value: 'secp256k1', label: 'Secp256k1', title: labels.secp256k1Hint },
            ]}
            value={curve}
            onChange={setCurve}
            size="sm"
          />
          <button
            type="button"
            onClick={handleDerive}
            disabled={!publicKeyHex.trim() || isDeriving}
            className="inline-flex items-center gap-2 px-5 h-9 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isDeriving ? (
              <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <KeyRound className="size-3.5" />
            )}
            {labels.deriveButton}
          </button>
        </div>
        {derived && (
          <div className="space-y-2 text-xs">
            {[
              { label: labels.derivedAccount, value: derived.accountAddress },
              { label: labels.derivedIdentity, value: derived.identityAddress },
            ].map((row) => (
              <div key={row.label} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold" style={{ color: 'var(--color-text-muted)' }}>{row.label}:</span>
                <code className="break-all" style={{ color: 'var(--color-text-main)' }}>{row.value}</code>
                <CopyButton value={row.value} size="xs" variant="minimal" />
              </div>
            ))}
          </div>
        )}
      </ToolSection>

      {/* Known addresses */}
      <ToolSection title={labels.knownTitle} hint={labels.knownHint}>
        {!knownAddresses ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <ScanSearch className="size-4 inline mr-1.5 align-text-bottom" />
            …
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {Object.entries(knownAddresses).map(([name, value]) => (
              <div key={name} className="flex items-center gap-2 text-xs min-w-0">
                <BookMarked className="size-3 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                <code className="font-bold shrink-0" style={{ color: 'var(--color-text-main)' }}>{name}</code>
                <code className="truncate" title={value} style={{ color: 'var(--color-text-muted)' }}>
                  {truncateAddress(value, 8, 6)}
                </code>
                <CopyButton value={value} size="xs" variant="minimal" />
              </div>
            ))}
          </div>
        )}
      </ToolSection>
    </div>
  );
}
