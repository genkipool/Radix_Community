'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  BadgeCheck,
  Braces,
  Code2,
  Coins,
  Flame,
  Globe2,
  Image as ImageIcon,
  KeyRound,
  MessageSquare,
  PackageOpen,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  availableBuckets,
  availableProofs,
  assignBlockNames,
  BLOCK_CATEGORIES,
  BLOCK_DEFS,
  buildManifestFromBlocks,
  createBlock,
  isBlockComplete,
  type BlockDef,
  type BlockInstance,
  type BlockType,
} from '../../lib/manifest-blocks';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { BuilderFieldInput, type BuilderFieldKind } from './BuilderFieldInput';

const BLOCK_ICONS: Record<BlockDef['icon'], ReactNode> = {
  upload: <Upload className="size-4" />,
  image: <ImageIcon className="size-4" />,
  package: <PackageOpen className="size-4" />,
  download: <ArrowDownToLine className="size-4" />,
  badge: <BadgeCheck className="size-4" />,
  tags: <Tags className="size-4" />,
  braces: <Braces className="size-4" />,
  code: <Code2 className="size-4" />,
  comment: <MessageSquare className="size-4" />,
  shield: <ShieldCheck className="size-4" />,
  flame: <Flame className="size-4" />,
  coins: <Coins className="size-4" />,
  key: <KeyRound className="size-4" />,
  globe: <Globe2 className="size-4" />,
  sparkles: <Sparkles className="size-4" />,
};

interface BlockLabels {
  name: string;
  description: string;
  fields: Record<string, string>;
}

interface BlockBuilderProps {
  t: ConsoleDictionary;
  onManifestChange: (manifest: string) => void;
  disabled?: boolean;
}

/** Blocks mode: compose the manifest as an ordered stack of instruction blocks. */
export function BlockBuilder({ t, onManifestChange, disabled }: BlockBuilderProps) {
  const labels = t.buildManifest;
  const blockLabels = labels.blocks as Record<string, BlockLabels>;
  const categoryLabels = labels.blockCategories as Record<string, string>;

  const [blocks, setBlocks] = useState<BlockInstance[]>([]);

  const { manifest } = buildManifestFromBlocks(blocks);
  useEffect(() => {
    onManifestChange(manifest);
  }, [manifest, onManifestChange]);

  const blockNames = assignBlockNames(blocks);

  const addBlock = (type: BlockType) => setBlocks((prev) => [...prev, createBlock(type)]);
  const removeBlock = (id: string) => setBlocks((prev) => prev.filter((block) => block.id !== id));
  const setValue = (id: string, key: string, value: string) =>
    setBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, values: { ...block.values, [key]: value } } : block)),
    );
  const move = (index: number, delta: number) =>
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div className="space-y-5">
      {/* Palette, grouped by instruction category */}
      <div className="space-y-4">
        <div
          className="flex items-center justify-between gap-3 pb-2 border-b"
          style={{ borderColor: 'var(--color-card-border)' }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
            {labels.addBlocks}
          </h3>
        </div>
        <div className="space-y-3">
          {BLOCK_CATEGORIES.map((category) => (
            <div key={category.id} className="space-y-1.5">
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {categoryLabels[category.id] ?? category.id}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {category.blocks.map((type) => {
                  const def = BLOCK_DEFS[type];
                  const meta = blockLabels[type] ?? { name: type, description: '', fields: {} };
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={disabled}
                      onClick={() => addBlock(type)}
                      title={meta.description}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-150 cursor-pointer hover:opacity-90 hover:shadow-sm active:scale-95 disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, rgba(${def.accentRgb},0.08) 0%, var(--color-surface) 70%)`,
                        borderColor: 'var(--color-card-border)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      <span style={{ color: `rgb(${def.accentRgb})` }} aria-hidden>
                        +
                      </span>
                      <span className="truncate max-w-[16rem]">{meta.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Block stack */}
      {blocks.length === 0 ? (
        <p
          className="text-sm text-center rounded-2xl border-2 border-dashed px-6 py-10 leading-relaxed"
          style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}
        >
          {labels.emptyBlocks}
        </p>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, index) => {
            const def = BLOCK_DEFS[block.type];
            const meta = blockLabels[block.type] ?? { name: block.type, description: '', fields: {} };
            const complete = isBlockComplete(block);
            const bucketName = blockNames.buckets.get(block.id);
            const proofName = blockNames.proofs.get(block.id);
            const addressNames = blockNames.addresses.get(block.id);
            const produces = [
              bucketName,
              proofName,
              addressNames && `${addressNames.reservation} · ${addressNames.address}`,
            ].filter(Boolean);
            return (
              <div
                key={block.id}
                className="rounded-2xl border p-4 space-y-3"
                style={{
                  background: `linear-gradient(135deg, rgba(${def.accentRgb},0.06) 0%, var(--color-card-bg) 55%)`,
                  borderColor: complete ? 'var(--color-card-border)' : 'rgba(245,158,11,0.5)',
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-3">
                  <span
                    className={`size-8 shrink-0 rounded-lg bg-gradient-to-br ${def.gradient} flex items-center justify-center text-white shadow`}
                    title={meta.description}
                  >
                    {BLOCK_ICONS[def.icon]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text-main)' }}>
                      {index + 1}. {meta.name}
                      {!complete && (
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30">
                          {labels.incompleteBadge}
                        </span>
                      )}
                    </p>
                    {produces.length > 0 && (
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        → {produces.join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={disabled || index === 0}
                      title={labels.moveUp}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface)] cursor-pointer disabled:opacity-30"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={disabled || index === blocks.length - 1}
                      title={labels.moveDown}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface)] cursor-pointer disabled:opacity-30"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      disabled={disabled}
                      title={labels.removeBlock}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500 cursor-pointer disabled:opacity-30"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Fields */}
                {def.fields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {def.fields.map((field) => (
                      <div
                        key={field.key}
                        className={field.kind === 'multiline' || field.kind === 'account' ? 'sm:col-span-2' : ''}
                      >
                        <BuilderFieldInput
                          t={t}
                          kind={field.kind as BuilderFieldKind}
                          label={meta.fields?.[field.key] ?? field.key}
                          value={block.values[field.key] ?? ''}
                          onChange={(value) => setValue(block.id, field.key, value)}
                          bucketOptions={availableBuckets(blocks, block.id)}
                          proofOptions={availableProofs(blocks, block.id)}
                          optional={field.optional}
                          disabled={disabled}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
