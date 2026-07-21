'use client';

import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { getClaimPackageRoyaltiesManifest } from '../../lib/claim-package-royalties-manifest';
import type { ConsoleToolProps } from '../ConsoleToolView';
import type { BadgeProofSelection } from '../../types/console.types';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { TxResultBanner } from '../shared/TxResultBanner';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { useAccountResources } from '../../hooks/useAccountResources';
import { AddressField } from '../shared/fields';
import { BadgeProofPicker } from '../shared/BadgeProofPicker';

export default function ClaimPackageRoyaltiesTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.claimPackageRoyalties;
  const { accounts, isLoading: walletLoading } = useRadixWallet();

  const [entityAddress, setEntityAddress] = useState('');
  const [ownerBadge, setOwnerBadge] = useState<BadgeProofSelection | null>(null);
  
  const accountAddress = accounts[0]?.address;
  const { data: holdings } = useAccountResources(accountAddress || null);
  
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  const isValid = (entityAddress.startsWith('package_') || entityAddress.startsWith('component_')) && entityAddress.length > 30;
  const canSend = isValid && !isSending && !!accountAddress && !walletLoading;

  const handleSend = () => {
    if (!canSend || !accountAddress) return;
    const manifest = getClaimPackageRoyaltiesManifest(accountAddress, entityAddress, ownerBadge || undefined);
    sendTransaction(manifest);
  };

  const handleSimulate = () => {
    if (!canSend || !accountAddress) return;
    const manifest = getClaimPackageRoyaltiesManifest(accountAddress, entityAddress, ownerBadge || undefined);
    preview.simulate(manifest);
  };

  return (
    <div className="space-y-5">
      <AddressField
        label={labels.entityAddress}
        placeholder={labels.entityAddressPlaceholder}
        value={entityAddress}
        onChange={setEntityAddress}
        disabled={isSending}
        hint={labels.entityAddressHint}
        categories={['package', 'component']}
      />
      
      <div className="pt-4">
        <BadgeProofPicker
          label={labels.ownerBadgeAddress}
          noneLabel={labels.noneBadge}
          accountAddress={accountAddress || null}
          holdings={holdings}
          value={ownerBadge}
          onChange={setOwnerBadge}
          disabled={isSending}
          hint={labels.ownerBadgeAddressHint}
        />
      </div>

      <TxResultBanner
        t={common}
        result={result}
        error={error}
        createdEntityLabel={labels.successClaim}
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
