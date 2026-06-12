'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  BadgeCheck,
  Braces,
  Code2,
  Image as ImageIcon,
  PackageOpen,
  Plus,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  availableBuckets,
  assignBucketNames,
  BLOCK_DEFS,
  BLOCK_PALETTE,
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

  const [blocks, setBlocks] = useState<BlockInstance[]>([]);

  const { manifest } = buildManifestFromBlocks(blocks);
  useEffect(() => {
    onManifestChange(manifest);
  }, [manifest, onManifestChange]);

  const bucketNames = assignBucketNames(blocks);

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
      {/* Palette */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {labels.addBlocks}
        </span>
        <div className="flex flex-wrap gap-2">
          {BLOCK_PALETTE.map((type) => {
            const def = BLOCK_DEFS[type];
            const meta = blockLabels[type] ?? { name: type, description: '', fields: {} };
            return (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => addBlock(type)}
                title={meta.description}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-150 cursor-pointer hover:-translate-y-px hover:border-[var(--color-primary)] active:scale-95 disabled:opacity-50"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-card-border)',
                  color: 'var(--color-text-main)',
                }}
              >
                <span
                  className={`size-6 rounded-md bg-gradient-to-br ${def.gradient} flex items-center justify-center text-white`}
                >
                  {BLOCK_ICONS[def.icon]}
                </span>
                {meta.name}
                <Plus className="size-3" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            );
          })}
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
            const bucketName = bucketNames.get(block.id);
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
                    {bucketName && (
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        → {bucketName}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {def.fields.map((field) => (
                    <div key={field.key} className={field.kind === 'multiline' || field.kind === 'account' ? 'sm:col-span-2' : ''}>
                      <BuilderFieldInput
                        t={t}
                        kind={field.kind as BuilderFieldKind}
                        label={meta.fields?.[field.key] ?? field.key}
                        value={block.values[field.key] ?? ''}
                        onChange={(value) => setValue(block.id, field.key, value)}
                        bucketOptions={availableBuckets(blocks, block.id)}
                        optional={field.optional}
                        disabled={disabled}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
