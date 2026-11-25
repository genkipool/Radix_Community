'use client';

import { Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { TextField } from '@/features/console/components/shared/fields';
import {
  isReservedCollectionMetadataKey,
  MAX_COLLECTION_META_FIELDS,
  type CollectionMetaField,
} from '../../lib/sign-request';
import type { CollectionLabels } from './CollectionPrimitives';

export interface CustomMetaField extends CollectionMetaField {
  id: string;
}

/**
 * Editable key/value/lock list for optional custom collection metadata fields.
 */
export function CustomMetadataEditor({
  labels,
  fields,
  disabled,
  onAdd,
  onRemove,
  onChange,
  onToggleLock,
}: {
  labels: CollectionLabels;
  fields: CustomMetaField[];
  disabled: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, part: 'key' | 'value', value: string) => void;
  onToggleLock: (id: string) => void;
}) {
  return (
    <div
      className="space-y-3 pt-4 border-t"
      style={{ borderColor: 'var(--color-card-border)' }}
    >
      <div className="space-y-1">
        <span
          className="block text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {labels.create.customTitle}
        </span>
        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {labels.create.customHint}
        </p>
      </div>

      {fields.map((field, index) => {
        const reserved =
          !!field.key.trim() && isReservedCollectionMetadataKey(field.key);
        return (
          <div
            key={field.id}
            className="flex flex-col sm:flex-row gap-3 items-start sm:items-end"
          >
            <div className="w-full sm:w-1/3">
              <TextField
                label={labels.create.customKey.replace(
                  '#{index}',
                  String(index + 1),
                )}
                value={field.key}
                onChange={(value) => onChange(field.id, 'key', value)}
                placeholder={labels.create.customKeyPlaceholder}
                error={reserved ? labels.create.customReserved : undefined}
                maxLength={64}
                disabled={disabled}
              />
            </div>
            <div className="w-full sm:flex-1">
              <TextField
                label={labels.create.customValue}
                labelEnd={
                  <button
                    type="button"
                    onClick={() => onToggleLock(field.id)}
                    disabled={disabled}
                    title={labels.create.customLockHint}
                    aria-pressed={field.locked}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors cursor-pointer disabled:opacity-50"
                    style={{
                      borderColor: field.locked
                        ? 'var(--color-primary)'
                        : 'var(--color-card-border)',
                      color: field.locked
                        ? 'var(--color-primary)'
                        : 'var(--color-text-muted)',
                      background: field.locked
                        ? 'rgba(var(--color-primary-rgb), 0.08)'
                        : 'transparent',
                    }}
                  >
                    {field.locked ? (
                      <Lock className="size-3" />
                    ) : (
                      <LockOpen className="size-3" />
                    )}
                    {labels.create.customLock}
                  </button>
                }
                value={field.value}
                onChange={(value) => onChange(field.id, 'value', value)}
                placeholder={labels.create.customValuePlaceholder}
                maxLength={256}
                disabled={disabled}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(field.id)}
              disabled={disabled}
              title={labels.create.customRemove}
              className="mb-[2px] p-2 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="size-4.5" />
            </button>
          </div>
        );
      })}

      {fields.length < MAX_COLLECTION_META_FIELDS && (
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer disabled:opacity-50"
          style={{ color: 'var(--color-primary)' }}
        >
          <Plus className="size-3.5" />
          {labels.create.customAdd}
        </button>
      )}
    </div>
  );
}
