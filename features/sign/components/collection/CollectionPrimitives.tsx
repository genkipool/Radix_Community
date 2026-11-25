'use client';

import { Dices, Lock, LockOpen } from 'lucide-react';
import type {
  useSealSetup,
  useSignCollections,
  useUserSeals,
} from '../../hooks/useSealRequest';
import type { SignDictionary } from '../../types/dictionary';

export type CollectionLabels = NonNullable<SignDictionary['collection']>;
export type SealSetupState = ReturnType<typeof useSealSetup>;
export type SealItem = ReturnType<typeof useUserSeals>['seals'][number];
export type SignCollectionItem =
  ReturnType<typeof useSignCollections>['collections'][number];
/** The editable metadata keys, shared by the form state and the manifest. */
export type ProfileKey = 'name' | 'symbol' | 'iconUrl' | 'orgName' | 'orgUrl';

/** A RUID is 68 characters of hex; nobody reads one, so show its head and tail. */
export function shortLocalId(localId: string): string {
  const bare = localId.replace(/^[#<[{]|[#>\]}]$/g, '');
  return bare.length > 18 ? `${bare.slice(0, 8)}…${bare.slice(-6)}` : bare;
}

/**
 * States, in one glance, whether the ledger will still accept a change to a key.
 */
export function LockBadge({
  locked,
  lockedLabel,
  editableLabel,
}: {
  locked: boolean;
  lockedLabel: string;
  editableLabel: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        borderColor: locked ? 'var(--color-card-border)' : 'var(--color-primary)',
        color: locked ? 'var(--color-text-muted)' : 'var(--color-primary)',
      }}
    >
      {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
      {locked ? lockedLabel : editableLabel}
    </span>
  );
}

/** Stokenet-only helper button that fills collection forms with coherent test data. */
export function StokenetFillButton({
  labels,
  disabled,
  onClick,
}: {
  labels: CollectionLabels['stokenetFill'];
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={labels.title}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] cursor-pointer disabled:opacity-40"
      style={{
        borderColor: 'var(--color-card-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text-main)',
      }}
    >
      <Dices className="size-3.5" />
      {labels.label}
    </button>
  );
}
