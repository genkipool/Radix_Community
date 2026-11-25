'use client';

import { BadgeCheck, Check, Plus } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import { useNftData } from '@/features/console/hooks/useNftData';
import { splitNftGlobalId } from '../../lib/network';
import {
  shortLocalId,
  type CollectionLabels,
  type SealItem,
} from './CollectionPrimitives';

/**
 * Reuse-vs-mint Seal insignia mode selector plus individual Seal picker when
 * the account holds more than one Seal NFT.
 */
export function SealModeSelector({
  labels,
  seals,
  chosenSeal,
  newSeal,
  disabled,
  onNewSealChange,
  onSelectSeal,
}: {
  labels: CollectionLabels;
  seals: SealItem[];
  chosenSeal: SealItem | null;
  newSeal: boolean;
  disabled: boolean;
  onNewSealChange: (next: boolean) => void;
  onSelectSeal: (globalId: string) => void;
}) {
  const sealResource = seals[0]
    ? splitNftGlobalId(seals[0].globalId).resource
    : null;
  const { data: sealData } = useNftData(
    sealResource,
    seals.map((seal) => seal.localId),
  );

  if (seals.length === 0) {
    return (
      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {labels.create.noSealNote}
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <p
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {labels.create.sealModeLabel}
        </p>
        <OptionButtons<'reuse' | 'new'>
          value={newSeal ? 'new' : 'reuse'}
          onChange={(mode) => onNewSealChange(mode === 'new')}
          disabled={disabled}
          layout="grid"
          className="grid-cols-1 sm:grid-cols-2"
          options={[
            {
              value: 'reuse',
              label: labels.create.reuseSeal,
              description: labels.create.reuseSealHint,
              icon: <BadgeCheck className="size-4" />,
            },
            {
              value: 'new',
              label: labels.create.newSeal,
              description: labels.create.newSealHint,
              icon: <Plus className="size-4" />,
            },
          ]}
        />
        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {newSeal ? labels.create.newSealNote : labels.create.reuseSealNote}
        </p>
      </div>

      {seals.length > 1 && (
        <div className="space-y-2">
          <p
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {labels.create.sealLabel}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {seals.map((seal) => {
              const data = sealData?.find((d) => d.id === seal.localId);
              const isChosen =
                !newSeal && chosenSeal?.globalId === seal.globalId;
              return (
                <button
                  key={seal.globalId}
                  type="button"
                  disabled={newSeal || disabled}
                  onClick={() => onSelectSeal(seal.globalId)}
                  title={seal.localId}
                  className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all enabled:cursor-pointer enabled:hover:border-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: isChosen
                      ? 'var(--color-primary)'
                      : 'var(--color-card-border)',
                    background: isChosen
                      ? 'rgba(var(--color-primary-rgb), 0.08)'
                      : 'var(--color-surface)',
                  }}
                >
                  <SafeImage
                    src={data?.imageUrl}
                    alt={data?.name || labels.seals.title}
                    fallbackName={data?.name || 'Radix Seal'}
                    className="size-11 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-bold"
                      style={{
                        color: isChosen
                          ? 'var(--color-primary)'
                          : 'var(--color-text-main)',
                      }}
                    >
                      {data?.name || labels.seals.title}
                    </span>
                    <span
                      className="block truncate font-mono text-[11px]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {shortLocalId(seal.localId)}
                    </span>
                  </span>
                  {isChosen && (
                    <Check
                      className="size-4 shrink-0"
                      style={{ color: 'var(--color-primary)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
