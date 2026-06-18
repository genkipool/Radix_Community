'use client';

import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { getDeployPackageManifest } from '../../lib/deploy-package-manifest';
import { fileToHex } from '../../lib/file-utils';
import { sborDecodeSchema } from '../../services/retClient';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';
import { FileDropzone } from '../shared/FileDropzone';
import {
  DEFAULT_OWNER_ROLE,
  OwnerRoleSelector,
  resolveAccessRule,
  type OwnerRoleState,
} from '../shared/OwnerRoleSelector';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { TxResultBanner } from '../shared/TxResultBanner';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';

export default function DeployPackageTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.deployPackage;
  const { activeNetwork, isLoading: walletLoading } = useRadixWallet();

  const [wasmFile, setWasmFile] = useState<File | null>(null);
  const [wasmHex, setWasmHex] = useState('');
  const [rpdFile, setRpdFile] = useState<File | null>(null);
  const [rpdDecoded, setRpdDecoded] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState(false);
  const [badgeAccount, setBadgeAccount] = useState<string | null>(null);
  const [ownerRole, setOwnerRole] = useState<OwnerRoleState>({ ...DEFAULT_OWNER_ROLE, kind: 'badge' });

  const { data: holdings } = useAccountResources(ownerRole.kind === 'badge' ? badgeAccount : null);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  const handleWasmFile = async (file: File | null) => {
    setWasmFile(file);
    setWasmHex(file ? await fileToHex(file) : '');
  };

  const handleRpdFile = async (file: File | null) => {
    setRpdFile(file);
    setRpdDecoded('');
    setDecodeError(false);
    if (!file) return;
    setIsDecoding(true);
    try {
      setRpdDecoded(await sborDecodeSchema(await fileToHex(file), activeNetwork));
    } catch {
      setDecodeError(true);
    }
    setIsDecoding(false);
  };

  const accessRule = resolveAccessRule(ownerRole, holdings);
  const canSend = !!wasmHex && !!rpdDecoded && !!accessRule && !isSending && !walletLoading;

  const handleSend = () => {
    if (!accessRule) return;
    const manifest = getDeployPackageManifest(wasmHex, rpdDecoded, accessRule, ownerRole.updatable);
    sendTransaction(manifest, { blobs: [wasmHex] });
  };

  const handleSimulate = () => {
    if (!accessRule) return;
    const manifest = getDeployPackageManifest(wasmHex, rpdDecoded, accessRule, ownerRole.updatable);
    preview.simulate(manifest, [wasmHex]);
  };

  return (
    <div className="space-y-5">
      <ToolSection title={labels.files}>
        <FileDropzone
          extension=".wasm"
          label={labels.wasmLabel}
          prompt={labels.dropWasm}
          file={wasmFile}
          onFile={handleWasmFile}
          disabled={isSending}
        />
        <FileDropzone
          extension=".rpd"
          label={labels.rpdLabel}
          prompt={labels.dropRpd}
          file={rpdFile}
          onFile={handleRpdFile}
          busy={isDecoding}
          error={decodeError ? labels.decodeError : undefined}
          disabled={isSending}
        />
      </ToolSection>

      <ToolSection title={common.ownerRole}>
        {ownerRole.kind === 'badge' && (
          <AccountPicker value={badgeAccount} onChange={setBadgeAccount} disabled={isSending} />
        )}
        <OwnerRoleSelector
          t={common}
          holdings={holdings}
          value={ownerRole}
          onChange={setOwnerRole}
          disabled={isSending}
        />
      </ToolSection>

      <TxResultBanner
        t={common}
        result={result}
        error={error}
        createdEntityLabel={labels.successPackage}
        onReset={reset}
      />

      {!result && !error && (
        <SimulateResultCard
          t={t.simulate}
          preview={preview.preview}
          error={preview.error}
          onClose={preview.reset}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <SendToWalletButton
          onClick={handleSend}
          disabled={!canSend}
          loading={isSending}
          label={common.sendToWallet}
          loadingLabel={common.sending}
        />
        <SimulateButton
          t={t.simulate}
          onClick={handleSimulate}
          disabled={!canSend}
          loading={preview.isSimulating}
        />
      </div>
    </div>
  );
}
