'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { buildManifestFlowSteps, type FlowLabels } from '../../lib/manifest-flow';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { ManifestEditor } from '../shared/ManifestEditor';
import { ManifestFlowDiagram } from '../shared/ManifestFlowDiagram';
import { PanelToggleButton, SidePanel } from '../shared/SidePanel';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { TxResultBanner } from '../shared/TxResultBanner';

const MANIFEST_DOCS_URL = 'https://docs.radixdlt.com/docs/transaction-manifest';
const FLOW_DEBOUNCE_MS = 500;

/** Debounced copy of the manifest so the diagram doesn't re-render per keystroke. */
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function TransactionManifestTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.manifest;
  const flowLabels = labels.flow as FlowLabels;

  const [manifest, setManifest] = useState('');
  const [showFlow, setShowFlow] = useState(false);
  const debouncedManifest = useDebouncedValue(manifest, FLOW_DEBOUNCE_MS);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();

  const steps = showFlow ? buildManifestFlowSteps(debouncedManifest, flowLabels) : null;

  const handleSend = async () => {
    const sent = await sendTransaction(manifest);
    if (sent) setManifest('');
  };

  return (
    <div className={`grid grid-cols-1 gap-6 items-start ${showFlow ? 'lg:grid-cols-2' : ''}`}>
      <div className="space-y-5 min-w-0">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.note}{' '}
            <a
              href={MANIFEST_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold transition-colors hover:text-[var(--color-accent)]"
              style={{ color: 'var(--color-primary)' }}
            >
              {labels.docsLink}
              <ExternalLink className="size-3" />
            </a>
          </p>
        </div>

        <ToolSection
          title={labels.label}
          action={
            <PanelToggleButton
              open={showFlow}
              onToggle={() => setShowFlow((prev) => !prev)}
              showLabel={labels.viewFlow}
              hideLabel={labels.hideFlow}
            />
          }
        >
          <ManifestEditor
            value={manifest}
            onChange={setManifest}
            placeholder={labels.placeholder}
            rows={16}
            disabled={isSending}
            ariaLabel={labels.label}
          />
        </ToolSection>

        <TxResultBanner t={common} result={result} error={error} onReset={reset} />

        <SendToWalletButton
          onClick={handleSend}
          disabled={!manifest.trim() || isSending}
          loading={isSending}
          label={common.sendToWallet}
          loadingLabel={common.sending}
        />
      </div>

      {showFlow && (
        <SidePanel title={labels.flowTitle}>
          {steps ? (
            <ManifestFlowDiagram steps={steps} labels={flowLabels} />
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {labels.flowEmpty}
            </p>
          )}
        </SidePanel>
      )}
    </div>
  );
}
