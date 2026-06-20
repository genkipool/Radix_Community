'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileSignature, Send } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { truncateAddress } from '@/utils/formatters';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useManifestValidation } from '../../hooks/useManifestValidation';
import { useSubintentRequest } from '../../hooks/useSubintentRequest';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { buildManifestFlowSteps, type FlowLabels } from '../../lib/manifest-flow';
import { decodeManifestParam } from '../../lib/saved-manifests';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ManifestEditor } from '../shared/ManifestEditor';
import { ManifestFlowDiagram } from '../shared/ManifestFlowDiagram';
import { ManifestLibrary } from '../shared/ManifestLibrary';
import { OptionButtons } from '../shared/OptionButtons';
import { PanelToggleButton, SidePanel } from '../shared/SidePanel';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';
import { TxResultBanner } from '../shared/TxResultBanner';
import { ValidationBadge } from '../shared/ValidationBadge';

const MANIFEST_DOCS_URL = 'https://docs.radixdlt.com/docs/manifest';
const FLOW_DEBOUNCE_MS = 500;

type SendMode = 'transaction' | 'subintent';

const EXPIRATION_OPTIONS = [
  { value: '300', label: '5 min' },
  { value: '900', label: '15 min' },
  { value: '3600', label: '1 h' },
];

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

  // Initialised from ?m=… so shared links open pre-filled (client-only read,
  // same initialiser pattern as DocsClient)
  const [manifest, setManifest] = useState(() => {
    if (typeof window === 'undefined') return '';
    const param = new URLSearchParams(window.location.search).get('m');
    return param ? decodeManifestParam(param) ?? '' : '';
  });
  const [showFlow, setShowFlow] = useState(false);
  const [sendMode, setSendMode] = useState<SendMode>('transaction');
  const [expiration, setExpiration] = useState('900');

  const debouncedManifest = useDebouncedValue(manifest, FLOW_DEBOUNCE_MS);
  const validation = useManifestValidation(debouncedManifest);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const subintent = useSubintentRequest();
  const preview = useTransactionPreview();

  const steps = showFlow ? buildManifestFlowSteps(debouncedManifest, flowLabels) : null;
  const busy = isSending || subintent.isSending;

  const handleSend = async () => {
    if (sendMode === 'subintent') {
      await subintent.sendSubintent(manifest, Number(expiration));
      return;
    }
    const sent = await sendTransaction(manifest);
    if (sent) setManifest('');
  };

  return (
    <div className={`grid grid-cols-1 gap-6 items-start ${showFlow ? 'lg:grid-cols-2' : ''} -mt-4`}>
      <div className="space-y-5 min-w-0">
        <div className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
          <p>
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

        <div className="space-y-4">
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
              {labels.label}
            </h3>
            <PanelToggleButton
              open={showFlow}
              onToggle={() => setShowFlow((prev) => !prev)}
              showLabel={labels.viewFlow}
              hideLabel={labels.hideFlow}
            />
          </header>
          <ManifestEditor
            value={manifest}
            onChange={setManifest}
            placeholder={labels.placeholder}
            rows={16}
            disabled={busy}
            ariaLabel={labels.label}
          />
          <ValidationBadge t={t.validation} validation={validation} />
        </div>

        <ManifestLibrary t={t.library} manifest={manifest} onLoad={setManifest} disabled={busy} />

        {/* Send mode: regular transaction vs. signed pre-authorization */}
        <div className="space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
            {labels.sendModeLabel}
          </span>
          <OptionButtons<SendMode>
            options={[
              { value: 'transaction', label: labels.sendModeTransaction, icon: <Send className="size-4" />, title: labels.sendModeTransactionHint },
              { value: 'subintent', label: labels.sendModeSubintent, icon: <FileSignature className="size-4" />, title: labels.sendModeSubintentHint },
            ]}
            value={sendMode}
            onChange={setSendMode}
            size="sm"
            disabled={busy}
          />
          {sendMode === 'subintent' && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {labels.subintentNote}
              </p>
              <OptionButtons
                options={EXPIRATION_OPTIONS.map((opt) => ({ ...opt, title: labels.expirationHint }))}
                value={expiration}
                onChange={setExpiration}
                size="sm"
                disabled={busy}
              />
            </div>
          )}
        </div>

        <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
        <TxResultBanner t={common} result={result} error={error} onReset={reset}  preview={preview.preview} />

        {subintent.error && (
          <p className="text-xs font-medium text-red-500">
            {(common.errors as Record<string, string>)[subintent.error] ?? subintent.error}
          </p>
        )}
        {subintent.result && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-2">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-500">
              <CheckCircle2 className="size-5" />
              {labels.subintentSuccess}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-semibold">{labels.subintentHash}:</span>
              <code style={{ color: 'var(--color-text-main)' }}>{truncateAddress(subintent.result.subintentHash, 14, 10)}</code>
              <CopyButton value={subintent.result.subintentHash} size="xs" variant="minimal" />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-semibold" title={labels.signedPartialHint}>{labels.signedPartial}:</span>
              <code style={{ color: 'var(--color-text-main)' }}>{truncateAddress(subintent.result.signedPartialTransaction, 14, 10)}</code>
              <CopyButton value={subintent.result.signedPartialTransaction} size="xs" variant="minimal" />
            </div>
          </div>
        )}

        <div className="flex w-full items-center gap-3">
          <SendToWalletButton
            onClick={handleSend}
            disabled={
              !manifest.trim() ||
              busy ||
              validation.status === 'invalid' ||
              (sendMode === 'transaction' && manifest.includes('YIELD_TO_PARENT'))
            }
            loading={busy}
            label={sendMode === 'subintent' ? labels.sendSubintent : common.sendToWallet}
            loadingLabel={common.sending}
          />
          {sendMode === 'transaction' && (
            <SimulateButton
              t={t.simulate}
              onClick={() => preview.simulate(manifest)}
              disabled={!manifest.trim() || busy}
              loading={preview.isSimulating}
            />
          )}
        </div>
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
