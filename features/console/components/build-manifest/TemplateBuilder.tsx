'use client';

import { useEffect, useState } from 'react';
import { Braces, Coins, Crown, Droplets, Flame, Image as ImageIcon, Landmark, Send, Tags, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useKnownAddresses } from '../../hooks/useKnownAddresses';
import {
  isTemplateComplete,
  MANIFEST_TEMPLATES,
  type ManifestTemplate,
} from '../../lib/manifest-templates';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { BuilderFieldInput, type BuilderFieldKind } from './BuilderFieldInput';

const TEMPLATE_ICONS: Record<ManifestTemplate['icon'], ReactNode> = {
  send: <Send className="size-4" />,
  image: <ImageIcon className="size-4" />,
  landmark: <Landmark className="size-4" />,
  undo: <Undo2 className="size-4" />,
  coins: <Coins className="size-4" />,
  flame: <Flame className="size-4" />,
  tags: <Tags className="size-4" />,
  braces: <Braces className="size-4" />,
  droplets: <Droplets className="size-4" />,
  crown: <Crown className="size-4" />,
};

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
  const values = (selectedId && valuesById[selectedId]) || {};

  const ctx = {
    xrdAddress: RADIX_TOKEN_ADDRESSES[activeNetworkId ?? RadixNetworkId.Mainnet].XRD,
    poolPackage: knownAddresses?.pool_package ?? '',
  };
  const manifest =
    template && isTemplateComplete(template, values) ? template.build(values, ctx) : '';

  useEffect(() => {
    onManifestChange(manifest);
  }, [manifest, onManifestChange]);

  const setValue = (key: string, value: string) => {
    if (!selectedId) return;
    setValuesById((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], [key]: value } }));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {labels.chooseTemplate}
        </span>
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
                className="flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer hover:-translate-y-px active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: isActive ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-card-bg)',
                  borderColor: isActive ? 'var(--color-primary)' : 'var(--color-card-border)',
                }}
              >
                <span
                  className={`size-8 shrink-0 rounded-lg bg-gradient-to-br ${candidate.gradient} flex items-center justify-center text-white shadow`}
                >
                  {TEMPLATE_ICONS[candidate.icon]}
                </span>
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
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {labels.templateFields}
          </span>
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
