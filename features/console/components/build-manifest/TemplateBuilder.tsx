'use client';

import { useEffect, useState } from 'react';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useKnownAddresses } from '../../hooks/useKnownAddresses';
import { MANIFEST_TEMPLATES } from '../../lib/manifest-templates';
import { defaultFieldValues } from '../../lib/field-defaults';
import type { OwnedValidator } from '../../hooks/useOwnedValidators';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { BuilderFieldInput, type BuilderFieldKind } from './BuilderFieldInput';
import { ValidatorOwnerPicker } from './ValidatorOwnerPicker';



interface TemplateLabels {
  name: string;
  description: string;
  fields: Record<string, string>;
}

interface TemplateBuilderProps {
  t: ConsoleDictionary;
  onManifestChange: (manifest: string) => void;
  disabled?: boolean;
}

/** Template mode: pick a recipe, fill in its parameters. */
export function TemplateBuilder({ t, onManifestChange, disabled }: TemplateBuilderProps) {
  const labels = t.buildManifest;
  const templateLabels = labels.templates as Record<string, TemplateLabels>;
  const { activeNetworkId } = useRadixWallet();

  const { data: knownAddresses } = useKnownAddresses();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [valuesById, setValuesById] = useState<Record<string, Record<string, string>>>({});

  const template = MANIFEST_TEMPLATES.find((candidate) => candidate.id === selectedId) ?? null;
  /*
   * Choice defaults are layered under the stored values rather than written
   * into state: the manifest commits to a branch from the first render, so
   * the control has to show one without a round-trip through setState.
   */
  const values = {
    ...(template ? defaultFieldValues(template.fields) : {}),
    ...((selectedId && valuesById[selectedId]) || {}),
  };

  const networkAddresses = RADIX_TOKEN_ADDRESSES[activeNetworkId ?? RadixNetworkId.Mainnet];
  const ctx = {
    xrdAddress: networkAddresses.XRD,
    poolPackage: knownAddresses?.pool_package ?? '',
    validatorOwnerBadge: networkAddresses.OWNER_BADGE,
  };
  const manifest =
    template ? template.build(values, ctx) : '';

  useEffect(() => {
    onManifestChange(manifest);
  }, [manifest, onManifestChange]);

  /** One write per change: two setValue calls would drop the first patch. */
  const patchValues = (patch: Record<string, string>) => {
    if (!selectedId) return;
    setValuesById((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], ...patch } }));
  };

  const setValue = (key: string, value: string) => patchValues({ [key]: value });

  /** Fills the address and the badge id the binding names, together. */
  const applyOwnedValidator = (validator: OwnedValidator) => {
    const binding = template?.validatorOwner;
    if (!binding) return;
    patchValues({
      [binding.validatorField]: validator.address,
      [binding.badgeIdField]: validator.badgeLocalId,
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div
          className="flex items-center justify-between gap-3 pb-2 border-b"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
            {labels.chooseTemplate}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {MANIFEST_TEMPLATES.map((candidate) => {
            const meta = templateLabels[candidate.id] ?? { name: candidate.id, description: '', fields: {} };
            const isActive = candidate.id === selectedId;
            return (
              <button
                key={candidate.id}
                type="button"
                disabled={disabled}
                onClick={() => setSelectedId(candidate.id)}
                title={meta.description}
                aria-pressed={isActive}
                className="flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer hover:opacity-90 hover:shadow-sm active:scale-95 disabled:opacity-50"
                style={{
                  background: isActive ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-card-bg)',
                  borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
                }}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight" style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                    {meta.name}
                  </span>
                  <span className="block text-[11px] mt-0.5 leading-snug line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                    {meta.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {template && (
        <div className="space-y-4">
          <div
            className="flex items-center justify-between gap-3 pb-2 border-b"
            style={{ borderColor: 'var(--color-card-border)' }}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
              {labels.templateFields}
            </h3>
          </div>
          {template.validatorOwner && values[template.validatorOwner.accountField] && (
            <ValidatorOwnerPicker
              t={t}
              accountAddress={values[template.validatorOwner.accountField]}
              selectedValidator={values[template.validatorOwner.validatorField] ?? ''}
              onSelect={applyOwnedValidator}
              disabled={disabled}
            />
          )}
          {template.fields.map((field) => (
            <BuilderFieldInput
              key={`${template.id}-${field.key}`}
              t={t}
              kind={field.kind as BuilderFieldKind}
              label={templateLabels[template.id]?.fields?.[field.key] ?? field.key}
              value={values[field.key] ?? ''}
              onChange={(value) => setValue(field.key, value)}
              choiceOptions={field.options}
              optional={field.optional}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
