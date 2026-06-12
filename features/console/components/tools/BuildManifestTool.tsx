'use client';

import { useState } from 'react';
import { Blocks, LayoutTemplate } from 'lucide-react';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { OptionButtons } from '../shared/OptionButtons';
import { ManifestLibrary } from '../shared/ManifestLibrary';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';
import { TxResultBanner } from '../shared/TxResultBanner';
import { TemplateBuilder } from '../build-manifest/TemplateBuilder';
import { BlockBuilder } from '../build-manifest/BlockBuilder';
import { ManifestPreviewPanel } from '../build-manifest/ManifestPreviewPanel';

type BuilderMode = 'templates' | 'blocks';

/**
 * Build-manifest tool: compose a transaction manifest from ready-made
 * templates or from ordered instruction blocks, with a live preview
 * (highlighted source + flow diagram) and direct wallet submission.
 */
export default function BuildManifestTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.buildManifest;

  const [mode, setMode] = useState<BuilderMode>('templates');
  // Each mode keeps its own manifest so switching modes never loses work
  const [manifests, setManifests] = useState<Record<BuilderMode, string>>({
    templates: '',
    blocks: '',
  });
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  const manifest = manifests[mode];
  const setTemplatesManifest = (value: string) =>
    setManifests((prev) => (prev.templates === value ? prev : { ...prev, templates: value }));
  const setBlocksManifest = (value: string) =>
    setManifests((prev) => (prev.blocks === value ? prev : { ...prev, blocks: value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <div className="space-y-5 min-w-0">
        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {labels.modeLabel}
          </span>
          <OptionButtons<BuilderMode>
            options={[
              {
                value: 'templates',
                label: labels.modeTemplates,
                icon: <LayoutTemplate className="size-4" />,
                title: labels.modeTemplatesHint,
              },
              {
                value: 'blocks',
                label: labels.modeBlocks,
                icon: <Blocks className="size-4" />,
                title: labels.modeBlocksHint,
              },
            ]}
            value={mode}
            onChange={setMode}
            disabled={isSending}
          />
        </div>

        {/* Both modes stay mounted so switching never loses state */}
        <div className={mode === 'templates' ? '' : 'hidden'}>
          <TemplateBuilder t={t} onManifestChange={setTemplatesManifest} disabled={isSending} />
        </div>
        <div className={mode === 'blocks' ? '' : 'hidden'}>
          <BlockBuilder t={t} onManifestChange={setBlocksManifest} disabled={isSending} />
        </div>

        <ManifestLibrary t={t.library} manifest={manifest} disabled={isSending} />

        <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} />
        <TxResultBanner t={common} result={result} error={error} onReset={reset} />

        <div className="flex flex-wrap items-center gap-3">
          <SendToWalletButton
            onClick={() => sendTransaction(manifest)}
            disabled={!manifest.trim() || isSending}
            loading={isSending}
            label={common.sendToWallet}
            loadingLabel={common.sending}
          />
          <SimulateButton
            t={t.simulate}
            onClick={() => preview.simulate(manifest)}
            disabled={!manifest.trim() || isSending}
            loading={preview.isSimulating}
          />
        </div>
      </div>

      <ManifestPreviewPanel t={t} manifest={manifest} />
    </div>
  );
}
