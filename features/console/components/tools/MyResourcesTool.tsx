'use client';

import { useState } from 'react';
import { ChevronDown, Coins, Crown, Flame, Layers, Lock, Snowflake, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useLanguage } from '@/context/LanguageContext';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { buildBadgeProofManifest } from '../../lib/badge-proof-manifest';
import {
  burnManifest,
  DEPOSIT_ALL_SUFFIX,
  freezeVaultManifest,
  lockMetadataManifest,
  mintFungibleManifest,
  mintNonFungibleManifest,
  recallManifest,
  setOwnerRoleManifest,
  type FreezeFlag,
  type SimpleAccessRule,
} from '../../lib/resource-actions';
import type { BadgeProofSelection } from '../../types/console.types';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';
import { BadgeProofPicker } from '../shared/BadgeProofPicker';
import { ManifestCode } from '../shared/ManifestCode';
import { OptionButtons } from '../shared/OptionButtons';
import { SelectField, TextField } from '../shared/fields';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';
import { TxResultBanner } from '../shared/TxResultBanner';

type ResourceAction =
  | 'mint'
  | 'mintNft'
  | 'burn'
  | 'lockMetadata'
  | 'setOwnerRole'
  | 'recall'
  | 'freeze';

const ACTION_ICONS: Record<ResourceAction, ReactNode> = {
  mint: <Coins className="size-4" />,
  mintNft: <Layers className="size-4" />,
  burn: <Flame className="size-4" />,
  lockMetadata: <Lock className="size-4" />,
  setOwnerRole: <Crown className="size-4" />,
  recall: <Undo2 className="size-4" />,
  freeze: <Snowflake className="size-4" />,
};

const FREEZE_FLAGS: FreezeFlag[] = ['withdraw', 'deposit', 'burn', 'all'];

export default function MyResourcesTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.myResources;
  const { language } = useLanguage();
  const { isLoading: walletLoading } = useRadixWallet();

  const [account, setAccount] = useState<string | null>(null);
  const [resource, setResource] = useState<string | null>(null);
  const [action, setAction] = useState<ResourceAction>('mint');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [proof, setProof] = useState<BadgeProofSelection | null>(null);
  const [showManifest, setShowManifest] = useState(false);

  const { data: holdings, isLoading: holdingsLoading } = useAccountResources(account);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  const field = (key: string) => (fields[key] ?? '').trim();
  const setField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const isFungible = !!holdings?.fungibles.some((f) => f.resourceAddress === resource);
  const isNonFungible = !!holdings?.nonFungibles.some((nf) => nf.resourceAddress === resource);

  const actionLabels = labels.actions as Record<string, { name: string; hint: string }>;
  const availableActions: ResourceAction[] = (
    ['mint', 'mintNft', 'burn', 'lockMetadata', 'setOwnerRole', 'recall', 'freeze'] as ResourceAction[]
  ).filter((candidate) => {
    if (candidate === 'mint') return isFungible;
    if (candidate === 'mintNft') return isNonFungible;
    if (candidate === 'burn') return isFungible;
    return true;
  });
  const activeAction = availableActions.includes(action) ? action : availableActions[0] ?? 'lockMetadata';

  /* ── Build the manifest for the configured action ── */
  const buildActionManifest = (): string => {
    if (!account || !resource) return '';
    switch (activeAction) {
      case 'mint':
        return field('amount')
          ? mintFungibleManifest(resource, field('amount')) + DEPOSIT_ALL_SUFFIX(account)
          : '';
      case 'mintNft':
        return field('nftId') && field('nftName')
          ? mintNonFungibleManifest(resource, {
              id: field('nftId'),
              name: field('nftName'),
              description: field('nftDescription'),
              keyImageUrl: field('nftImageUrl'),
            }) + DEPOSIT_ALL_SUFFIX(account)
          : '';
      case 'burn':
        return field('amount') ? burnManifest(account, resource, field('amount')) : '';
      case 'lockMetadata':
        return field('metadataKey') ? lockMetadataManifest(resource, field('metadataKey')) : '';
      case 'setOwnerRole': {
        const kind = field('ruleKind') as SimpleAccessRule['kind'] | '';
        if (!kind) return '';
        if (kind === 'badge' && !field('badgeResource')) return '';
        const rule: SimpleAccessRule =
          kind === 'badge' ? { kind, resourceAddress: field('badgeResource') } : { kind };
        return setOwnerRoleManifest(resource, rule);
      }
      case 'recall':
        return field('vault') && field('amount')
          ? recallManifest(field('vault'), field('amount')) + DEPOSIT_ALL_SUFFIX(account)
          : '';
      case 'freeze':
        return field('vault') && field('flag')
          ? freezeVaultManifest(field('vault'), field('flag') as FreezeFlag, field('mode') !== 'unfreeze')
          : '';
    }
  };

  const actionManifest = buildActionManifest();
  const manifest = actionManifest
    ? (proof ? buildBadgeProofManifest([proof]) : '') + actionManifest
    : '';
  const canSend = !!manifest && !isSending && !walletLoading;

  const badgeOptions = [
    ...(holdings?.fungibles ?? []).map((f) => ({
      value: f.resourceAddress,
      label: `${f.name || f.symbol || 'Unnamed'} (${truncateAddress(f.resourceAddress, 8, 6)})`,
    })),
    ...(holdings?.nonFungibles ?? []).map((nf) => ({
      value: nf.resourceAddress,
      label: `${nf.name || 'Unnamed'} (${truncateAddress(nf.resourceAddress, 8, 6)})`,
    })),
  ];

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountTitle}>
        <AccountPicker value={account} onChange={setAccount} disabled={isSending} />

        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {labels.resourceTitle}
          </span>
          {holdingsLoading ? (
            <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>{labels.loading}</p>
          ) : (
            <OptionButtons
              options={[
                ...(holdings?.fungibles ?? []).map((f) => ({
                  value: f.resourceAddress,
                  label: f.symbol || f.name || truncateAddress(f.resourceAddress, 8, 6),
                  description: `${formatNumber(Number(f.amount), 4, language)} · ${truncateAddress(f.resourceAddress, 6, 5)}`,
                })),
                ...(holdings?.nonFungibles ?? []).map((nf) => ({
                  value: nf.resourceAddress,
                  label: nf.name || truncateAddress(nf.resourceAddress, 8, 6),
                  description: `${nf.ids.length} NFT · ${truncateAddress(nf.resourceAddress, 6, 5)}`,
                })),
              ]}
              value={resource}
              onChange={setResource}
              size="sm"
              disabled={isSending}
            />
          )}
        </div>

        <BadgeProofPicker
          label={common.createProof}
          noneLabel={t.metadata.proofNone}
          hint={labels.proofHint}
          accountAddress={account}
          holdings={holdings}
          value={proof}
          onChange={setProof}
          disabled={isSending}
        />
      </ToolSection>

      {resource && (
        <ToolSection
          title={labels.actionTitle}
          action={
            <button
              type="button"
              onClick={() => setShowManifest((prev) => !prev)}
              aria-expanded={showManifest}
              className="inline-flex items-center gap-1 text-[11px] font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <ChevronDown className={`size-3 transition-transform ${showManifest ? 'rotate-180' : ''}`} />
              {labels.viewManifest}
            </button>
          }
        >
          <OptionButtons<ResourceAction>
            options={availableActions.map((candidate) => ({
              value: candidate,
              label: actionLabels[candidate]?.name ?? candidate,
              icon: ACTION_ICONS[candidate],
              title: actionLabels[candidate]?.hint,
            }))}
            value={activeAction}
            onChange={setAction}
            size="sm"
            disabled={isSending}
          />

          {(activeAction === 'mint' || activeAction === 'burn') && (
            <TextField
              label={labels.fields.amount}
              value={fields.amount ?? ''}
              onChange={(value) => setField('amount', value)}
              type="number"
              disabled={isSending}
            />
          )}

          {activeAction === 'mintNft' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label={labels.fields.nftId}
                hint={labels.fields.nftIdHint}
                value={fields.nftId ?? ''}
                onChange={(value) => setField('nftId', value)}
                placeholder="#1#"
                disabled={isSending}
              />
              <TextField
                label={labels.fields.nftName}
                value={fields.nftName ?? ''}
                onChange={(value) => setField('nftName', value)}
                disabled={isSending}
              />
              <TextField
                label={labels.fields.nftDescription}
                value={fields.nftDescription ?? ''}
                onChange={(value) => setField('nftDescription', value)}
                disabled={isSending}
              />
              <TextField
                label={labels.fields.nftImageUrl}
                value={fields.nftImageUrl ?? ''}
                onChange={(value) => setField('nftImageUrl', value)}
                disabled={isSending}
              />
            </div>
          )}

          {activeAction === 'lockMetadata' && (
            <TextField
              label={labels.fields.metadataKey}
              hint={labels.fields.metadataKeyHint}
              value={fields.metadataKey ?? ''}
              onChange={(value) => setField('metadataKey', value)}
              placeholder="name"
              disabled={isSending}
            />
          )}

          {activeAction === 'setOwnerRole' && (
            <>
              <OptionButtons
                options={[
                  { value: 'allowAll', label: common.ownerRole_allowAll, title: t.createToken.optionHints.allowAll },
                  { value: 'denyAll', label: t.createToken.denyAll, title: t.createToken.optionHints.denyAll },
                  { value: 'badge', label: common.ownerRole_badge },
                ]}
                value={fields.ruleKind ?? ''}
                onChange={(value) => setField('ruleKind', value)}
                size="sm"
                disabled={isSending}
              />
              {fields.ruleKind === 'badge' && (
                <SelectField
                  label={common.badgeResource}
                  placeholder={common.selectBadge}
                  value={fields.badgeResource ?? ''}
                  onChange={(value) => setField('badgeResource', value)}
                  options={badgeOptions}
                  disabled={isSending}
                />
              )}
            </>
          )}

          {(activeAction === 'recall' || activeAction === 'freeze') && (
            <TextField
              label={labels.fields.vault}
              hint={labels.fields.vaultHint}
              value={fields.vault ?? ''}
              onChange={(value) => setField('vault', value)}
              placeholder="internal_vault_..."
              disabled={isSending}
            />
          )}
          {activeAction === 'recall' && (
            <TextField
              label={labels.fields.amount}
              value={fields.amount ?? ''}
              onChange={(value) => setField('amount', value)}
              type="number"
              disabled={isSending}
            />
          )}
          {activeAction === 'freeze' && (
            <>
              <OptionButtons
                options={[
                  { value: 'freeze', label: labels.fields.freeze, title: labels.fields.freezeHint },
                  { value: 'unfreeze', label: labels.fields.unfreeze, title: labels.fields.unfreezeHint },
                ]}
                value={fields.mode ?? 'freeze'}
                onChange={(value) => setField('mode', value)}
                size="sm"
                disabled={isSending}
              />
              <OptionButtons
                options={FREEZE_FLAGS.map((flag) => ({
                  value: flag,
                  label: (labels.fields.flags as Record<string, string>)[flag] ?? flag,
                }))}
                value={fields.flag ?? ''}
                onChange={(value) => setField('flag', value)}
                size="sm"
                disabled={isSending}
              />
            </>
          )}

          {showManifest && manifest && <ManifestCode code={manifest} />}
        </ToolSection>
      )}

      <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
      <TxResultBanner t={common} result={result} error={error} onReset={reset} />

      <div className="flex w-full items-center gap-3">
        <SendToWalletButton
          onClick={() => sendTransaction(manifest)}
          disabled={!canSend}
          loading={isSending}
          label={common.sendToWallet}
          loadingLabel={common.sending}
        />
        <SimulateButton
          t={t.simulate}
          onClick={() => preview.simulate(manifest)}
          disabled={!manifest || isSending}
          loading={preview.isSimulating}
        />
      </div>
    </div>
  );
}
