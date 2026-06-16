'use client';

import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { TransactionBuilder } from '@/features/wallet/components/TransactionBuilder';
import { CopyButton } from '@/components/ui/CopyButton';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';
import { PanelToggleButton, SidePanel } from '../shared/SidePanel';
import { ManifestCode } from '../shared/ManifestCode';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';

/**
 * Send-transaction tool — the same transfer builder used in the wallet
 * profile modal, plus a live manifest viewer in a side panel.
 */
export default function SendTransactionTool({ t }: ConsoleToolProps) {
  const labels = t.sendTransaction;
  const { t: fullDictionary, language } = useLanguage();

  const [account, setAccount] = useState<string | null>(null);
  const [manifest, setManifest] = useState('');
  const [showManifest, setShowManifest] = useState(false);

  const preview = useTransactionPreview();

  return (
    <div className={`grid grid-cols-1 gap-6 items-start ${showManifest ? 'lg:grid-cols-2' : ''}`}>
      <div className="space-y-5 min-w-0">
        <ToolSection title={t.common.fromAccount}>
          <AccountPicker value={account} onChange={setAccount} />
        </ToolSection>

        {account && (
          <ToolSection
            title={labels.builder}
            action={
              <PanelToggleButton
                open={showManifest}
                onToggle={() => setShowManifest((prev) => !prev)}
                showLabel={labels.viewManifest}
                hideLabel={labels.hideManifest}
              />
            }
          >
            <TransactionBuilder
              accountAddress={account}
              t={fullDictionary}
              locale={language}
              onManifestChange={setManifest}
              actions={
                <SimulateButton
                  t={t.simulate}
                  onClick={() => preview.simulate(manifest)}
                  disabled={!manifest.trim() || preview.isSimulating}
                  loading={preview.isSimulating}
                />
              }
            />
            <div className="mt-4">
              <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} />
            </div>
          </ToolSection>
        )}
      </div>

      {showManifest && (
        <SidePanel
          title={labels.manifestTitle}
          action={manifest ? <CopyButton value={manifest} size="xs" variant="ghost" label={t.common.copy} /> : undefined}
        >
          {manifest ? (
            <ManifestCode code={manifest} />
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {labels.manifestEmpty}
            </p>
          )}
        </SidePanel>
      )}
    </div>
  );
}
