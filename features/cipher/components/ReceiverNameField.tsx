'use client';

import { BadgeCheck } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { TextField } from '@/features/console/components/shared/fields';
import type { CipherDictionary } from '../types/dictionary';

/**
 * Name shown to the sender in the approval card. Parents seed the value with
 * `usePersonaName()` when a wallet persona is connected; otherwise free text —
 * the receiver needs no wallet just to receive a file.
 */
export function ReceiverNameField({
  t,
  value,
  onChange,
  disabled,
}: {
  t: CipherDictionary;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const personaLabel = usePersonaName();

  return (
    <div className="space-y-1">
      <TextField
        label={t.receiver.nameLabel}
        value={value}
        onChange={onChange}
        placeholder={t.receiver.namePlaceholder}
        disabled={disabled}
        maxLength={64}
      />
      {personaLabel && value === personaLabel && (
        <p
          className="flex items-center gap-1 text-[11px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <BadgeCheck className="size-3.5" style={{ color: 'var(--color-primary)' }} />
          {t.receiver.personaHint}
        </p>
      )}
    </div>
  );
}

/** Connected persona label, or null — used to pre-seed the name state. */
export function usePersonaName(): string | null {
  const { isConnected, persona } = useRadixWallet();
  return isConnected ? persona?.label ?? null : null;
}
