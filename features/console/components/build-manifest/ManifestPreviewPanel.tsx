'use client';

import { useState } from 'react';
import { FileCode2, GitBranch } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { buildManifestFlowSteps, type FlowLabels } from '../../lib/manifest-flow';
import type { ConsoleDictionary } from '../../types/i18n.types';
import { SidePanel } from '../shared/SidePanel';
import { OptionButtons } from '../shared/OptionButtons';
import { ManifestCode } from '../shared/ManifestCode';
import { ManifestFlowDiagram } from '../shared/ManifestFlowDiagram';

type PreviewTab = 'manifest' | 'flow';

interface ManifestPreviewPanelProps {
  t: ConsoleDictionary;
  manifest: string;
}

/**
 * Live preview of a manifest under construction: highlighted source and the
 * step-by-step flow diagram, switchable with tabs.
 */
export function ManifestPreviewPanel({ t, manifest }: ManifestPreviewPanelProps) {
  const labels = t.buildManifest;
  const flowLabels = t.manifest.flow as FlowLabels;
  const [tab, setTab] = useState<PreviewTab>('manifest');

  const steps = tab === 'flow' && manifest ? buildManifestFlowSteps(manifest, flowLabels) : null;

  return (
    <SidePanel
      title={labels.panelTitle}
      action={
        tab === 'manifest' && manifest
          ? <CopyButton value={manifest} size="xs" variant="ghost" label={t.common.copy} />
          : undefined
      }
    >
      <OptionButtons<PreviewTab>
        options={[
          { value: 'manifest', label: labels.tabManifest, icon: <FileCode2 className="size-4" /> },
          { value: 'flow', label: labels.tabFlow, icon: <GitBranch className="size-4" /> },
        ]}
        value={tab}
        onChange={setTab}
      />

      {!manifest ? (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {labels.emptyPreview}
        </p>
      ) : tab === 'manifest' ? (
        <ManifestCode code={manifest} />
      ) : steps ? (
        <ManifestFlowDiagram steps={steps} labels={flowLabels} />
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {labels.emptyPreview}
        </p>
      )}
    </SidePanel>
  );
}
