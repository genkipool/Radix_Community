'use client';

import { useState } from 'react';
import { BadgePlus, ChevronDown, Coins, Layers, Lock, LockOpen, Plus, Trash2 } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import {
  createFungibleTokenManifest,
  createNonFungibleTokenManifest,
  DEFAULT_AUTH_ROLES,
  type NftItemData,
  type ResourceAuthRoles,
} from '../../lib/create-token-manifests';
import type { AuthRoleValue } from '../../lib/access-rules';
import {
  initialMetadataArrayEntry,
  initialMetadataEntry,
  MetadataType,
  type MetadataTypeValue,
} from '../../lib/metadata-manifests';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';
import { OptionButtons } from '../shared/OptionButtons';
import { TextField, TextAreaField } from '../shared/fields';
import {
  DEFAULT_OWNER_ROLE,
  OwnerRoleSelector,
  resolveAccessRule,
  type OwnerRoleState,
} from '../shared/OwnerRoleSelector';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { TxResultBanner } from '../shared/TxResultBanner';

type TokenType = 'fungible' | 'nonFungible';

/* ─── Metadata form model ─────────────────────────────────────────────────── */

type MetaKey = 'name' | 'symbol' | 'icon_url' | 'description' | 'tags' | 'info_url';

interface MetaFieldState {
  value: string;
  locked: boolean;
}

interface CustomMetaFieldState {
  id: string;
  key: string;
  value: string;
  locked: boolean;
}

type MetadataState = Record<MetaKey, MetaFieldState>;

const EMPTY_METADATA: MetadataState = {
  name: { value: '', locked: false },
  symbol: { value: '', locked: false },
  icon_url: { value: '', locked: false },
  description: { value: '', locked: false },
  tags: { value: '', locked: false },
  info_url: { value: '', locked: false },
};

const META_TYPES: Record<MetaKey, MetadataTypeValue> = {
  name: MetadataType.String,
  symbol: MetadataType.String,
  icon_url: MetadataType.Url,
  description: MetadataType.String,
  tags: MetadataType.StringArray,
  info_url: MetadataType.Url,
};

const OWNER_BADGE_ICON = 'https://assets.radixdlt.com/icons/icon-package_owner_badge.png';

function buildMetadataEntries(metadata: MetadataState, customMetadata: CustomMetaFieldState[], tokenType: TokenType): string {
  const keys: MetaKey[] = ['name', 'symbol', 'icon_url', 'description', 'tags', 'info_url'];
  const standardEntries = keys
    .flatMap((key) => {
      const { value, locked } = metadata[key];
      if (!value.trim()) return [];
      if (key === 'symbol' && tokenType !== 'fungible') return [];
      if (key === 'tags') {
        const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
        return tags.length ? [initialMetadataArrayEntry(key, tags, locked)] : [];
      }
      return [initialMetadataEntry(key, value.trim(), locked, META_TYPES[key])];
    });

  const customEntries = customMetadata.flatMap(({ key, value, locked }) => {
    if (!key.trim() || !value.trim()) return [];
    return [initialMetadataEntry(key.trim(), value.trim(), locked, MetadataType.String)];
  });

  return [...standardEntries, ...customEntries].join(',');
}

/* ─── Auth roles ──────────────────────────────────────────────────────────── */

const AUTH_ROLE_PAIRS: Array<{ setter: keyof ResourceAuthRoles; updater: keyof ResourceAuthRoles; nftOnly?: boolean; setterOptions?: AuthRoleValue[] }> = [
  { setter: 'minter', updater: 'minter_updater' },
  { setter: 'burner', updater: 'burner_updater' },
  { setter: 'freezer', updater: 'freezer_updater' },
  { setter: 'recaller', updater: 'recaller_updater' },
  { setter: 'withdrawer', updater: 'withdrawer_updater' },
  { setter: 'depositer', updater: 'depositer_updater', setterOptions: ['allowAll'] },
  { setter: 'metadata_setter', updater: 'metadata_setter_updater' },
  { setter: 'metadata_locker', updater: 'metadata_locker_updater' },
  { setter: 'nft_data_setter', updater: 'nft_data_setter_updater', nftOnly: true },
];

function AuthRoleRow({
  roleKey,
  roleHint,
  value,
  onChange,
  options,
  labels,
  optionHints,
  disabled,
}: {
  roleKey: string;
  /** Tooltip explaining what this role controls */
  roleHint?: string;
  value: AuthRoleValue;
  onChange: (value: AuthRoleValue) => void;
  options: AuthRoleValue[];
  labels: Record<AuthRoleValue, string>;
  /** Tooltips explaining each access-rule choice */
  optionHints: Record<AuthRoleValue, string>;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-1.5">
      <code
        className="text-xs sm:w-64 shrink-0 cursor-help"
        style={{ color: 'var(--color-text-muted)' }}
        title={roleHint}
      >
        {roleKey}
      </code>
      <OptionButtons<AuthRoleValue>
        options={options.map((opt) => ({ value: opt, label: labels[opt], title: optionHints[opt] }))}
        value={value}
        onChange={onChange}
        size="sm"
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}

/* ─── Lock toggle ─────────────────────────────────────────────────────────── */

function LockToggle({
  locked,
  onToggle,
  label,
  hint,
  disabled,
}: {
  locked: boolean;
  onToggle: () => void;
  label: string;
  hint: string;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={hint}
      aria-pressed={locked}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors cursor-pointer disabled:opacity-50"
      style={{
        borderColor: locked ? 'var(--color-primary)' : 'var(--color-card-border)',
        color: locked ? 'var(--color-primary)' : 'var(--color-text-muted)',
        background: locked ? 'rgba(var(--color-primary-rgb), 0.08)' : 'transparent',
      }}
    >
      {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
      {label}
    </button>
  );
}

/* ─── Tool ────────────────────────────────────────────────────────────────── */

export default function CreateTokenTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.createToken;
  const { isLoading: walletLoading } = useRadixWallet();

  const [account, setAccount] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<TokenType>('fungible');
  const [trackSupply, setTrackSupply] = useState(true);
  const [initialSupply, setInitialSupply] = useState('');
  const [divisibility, setDivisibility] = useState('0');
  const [metadata, setMetadata] = useState<MetadataState>(EMPTY_METADATA);
  const [customMetadata, setCustomMetadata] = useState<CustomMetaFieldState[]>([]);
  const [ownerRole, setOwnerRole] = useState<OwnerRoleState>(DEFAULT_OWNER_ROLE);
  const [authRoles, setAuthRoles] = useState<ResourceAuthRoles>(DEFAULT_AUTH_ROLES);
  const [showAuthRoles, setShowAuthRoles] = useState(false);
  const [nfts, setNfts] = useState<Array<{ id: string; data: NftItemData }>>([]);

  const { data: holdings } = useAccountResources(ownerRole.kind === 'badge' ? account : null);
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();

  const setMetaValue = (key: MetaKey, value: string) =>
    setMetadata((prev) => ({ ...prev, [key]: { ...prev[key], value } }));
  const toggleMetaLock = (key: MetaKey) =>
    setMetadata((prev) => ({ ...prev, [key]: { ...prev[key], locked: !prev[key].locked } }));

  const addCustomMeta = () =>
    setCustomMetadata((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key: '', value: '', locked: false },
    ]);
  const removeCustomMeta = (id: string) =>
    setCustomMetadata((prev) => prev.filter((m) => m.id !== id));
  const setCustomMetaField = (id: string, field: 'key' | 'value', value: string) =>
    setCustomMetadata((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  const toggleCustomMetaLock = (id: string) =>
    setCustomMetadata((prev) => prev.map((m) => (m.id === id ? { ...m, locked: !m.locked } : m)));

  const addNft = (data?: Partial<NftItemData>) =>
    setNfts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        data: { name: data?.name ?? '', description: data?.description ?? '', key_image_url: data?.key_image_url ?? '' },
      },
    ]);
  const removeNft = (id: string) => setNfts((prev) => prev.filter((nft) => nft.id !== id));
  const setNftField = (id: string, field: keyof NftItemData, value: string) =>
    setNfts((prev) => prev.map((nft) => (nft.id === id ? { ...nft, data: { ...nft.data, [field]: value } } : nft)));

  /** Preset that prefills the form to mint a simple owner badge. */
  const applyBadgePreset = () => {
    setTokenType('nonFungible');
    setMetadata({
      ...EMPTY_METADATA,
      name: { value: 'Owner Badges', locked: false },
      icon_url: { value: OWNER_BADGE_ICON, locked: false },
      tags: { value: 'badge', locked: false },
      description: {
        value: 'Badges created by the Radix system that provide individual control over resources deployed by developers.',
        locked: false,
      },
    });
    setOwnerRole(DEFAULT_OWNER_ROLE);
    setCustomMetadata([]);
    setNfts([]);
    addNft({ name: 'Badge', description: 'A simple badge', key_image_url: OWNER_BADGE_ICON });
  };

  /* ── Validation ── */
  const supplyValid = Number(initialSupply) > 0;
  const divisibilityValid =
    /^\d+$/.test(divisibility) && Number(divisibility) >= 0 && Number(divisibility) <= 18;
  const urlValid = (value: string) => !value.trim() || value.trim().startsWith('https://');
  const iconUrlValid = urlValid(metadata.icon_url.value);
  const infoUrlValid = urlValid(metadata.info_url.value);
  const nftsValid = nfts.length > 0 && nfts.every((nft) => nft.data.name.trim());

  const customMetaValid = customMetadata.every((m) => m.key.trim() && m.value.trim());

  const accessRule = resolveAccessRule(ownerRole, holdings);
  const typeValid = tokenType === 'fungible' ? supplyValid && divisibilityValid : nftsValid;
  const canSend =
    !!account && !!accessRule && typeValid && iconUrlValid && infoUrlValid && customMetaValid && !isSending && !walletLoading;

  const handleSend = () => {
    if (!account || !accessRule) return;
    const metadataEntries = buildMetadataEntries(metadata, customMetadata, tokenType);
    const manifest =
      tokenType === 'fungible'
        ? createFungibleTokenManifest({
            ownerAccessRule: accessRule,
            ownerRoleUpdatable: ownerRole.updatable,
            accountAddress: account,
            trackSupply,
            divisibility,
            initialSupply,
            metadata: metadataEntries,
            authRoles,
          })
        : createNonFungibleTokenManifest({
            ownerAccessRule: accessRule,
            ownerRoleUpdatable: ownerRole.updatable,
            accountAddress: account,
            trackSupply,
            metadata: metadataEntries,
            authRoles,
            nfts: nfts.map((nft) => nft.data),
          });
    sendTransaction(manifest);
  };

  const authRoleLabels: Record<AuthRoleValue, string> = {
    owner: labels.owner,
    allowAll: labels.allowAll,
    denyAll: labels.denyAll,
  };
  const authRoleOptionHints = labels.optionHints as Record<AuthRoleValue, string>;
  const authRoleHints = labels.roleHints as Record<string, string>;

  const lockToggle = (key: MetaKey) => (
    <LockToggle
      locked={metadata[key].locked}
      onToggle={() => toggleMetaLock(key)}
      label={labels.lock}
      hint={labels.lockHint}
      disabled={isSending}
    />
  );

  return (
    <div className="space-y-5">
      <ToolSection title={labels.depositAccount}>
        <AccountPicker value={account} onChange={setAccount} disabled={isSending} />
      </ToolSection>

      <ToolSection title={labels.tokenType}>
        <OptionButtons<TokenType>
          options={[
            { value: 'fungible', label: labels.fungible, icon: <Coins className="size-4" /> },
            { value: 'nonFungible', label: labels.nonFungible, icon: <Layers className="size-4" /> },
          ]}
          value={tokenType}
          onChange={setTokenType}
          disabled={isSending}
        />

        <div className="flex flex-col gap-4">
          <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            {labels.trackSupply}
          </span>
          <OptionButtons
            options={[
              { value: 'true', label: labels.yes },
              { value: 'false', label: labels.no },
            ]}
            value={String(trackSupply)}
            onChange={(value) => setTrackSupply(value === 'true')}
            size="sm"
            disabled={isSending}
          />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{labels.trackSupplyHint}</p>
        </div>

        {tokenType === 'fungible' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label={labels.initialSupply}
              value={initialSupply}
              onChange={setInitialSupply}
              type="number"
              placeholder={labels.initialSupplyPlaceholder}
              error={initialSupply && !supplyValid ? labels.invalidSupply : undefined}
              disabled={isSending}
            />
            <TextField
              label={labels.divisibility}
              value={divisibility}
              onChange={setDivisibility}
              type="number"
              placeholder={labels.divisibilityPlaceholder}
              error={divisibility && !divisibilityValid ? labels.invalidDivisibility : undefined}
              disabled={isSending}
            />
          </div>
        )}
      </ToolSection>

      <ToolSection title={labels.metadata}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label={labels.name}
            labelEnd={lockToggle('name')}
            value={metadata.name.value}
            onChange={(value) => setMetaValue('name', value)}
            placeholder={labels.namePlaceholder}
            disabled={isSending}
          />
          {tokenType === 'fungible' && (
            <TextField
              label={labels.symbol}
              labelEnd={lockToggle('symbol')}
              value={metadata.symbol.value}
              onChange={(value) => setMetaValue('symbol', value)}
              placeholder={labels.symbolPlaceholder}
              disabled={isSending}
            />
          )}
          <TextField
            label={labels.iconUrl}
            labelEnd={lockToggle('icon_url')}
            value={metadata.icon_url.value}
            onChange={(value) => setMetaValue('icon_url', value)}
            placeholder={labels.iconUrlPlaceholder}
            error={!iconUrlValid ? labels.invalidUrl : undefined}
            disabled={isSending}
          />
          <TextField
            label={labels.infoUrl}
            labelEnd={lockToggle('info_url')}
            value={metadata.info_url.value}
            onChange={(value) => setMetaValue('info_url', value)}
            placeholder={labels.infoUrlPlaceholder}
            error={!infoUrlValid ? labels.invalidUrl : undefined}
            disabled={isSending}
          />
          <TextField
            label={labels.tags}
            labelEnd={lockToggle('tags')}
            value={metadata.tags.value}
            onChange={(value) => setMetaValue('tags', value)}
            placeholder={labels.tagsPlaceholder}
            disabled={isSending}
          />
        </div>
        <TextAreaField
          label={labels.description}
          labelEnd={lockToggle('description')}
          value={metadata.description.value}
          onChange={(value) => setMetaValue('description', value)}
          placeholder={labels.descriptionPlaceholder}
          rows={3}
          disabled={isSending}
        />

        {customMetadata.length > 0 && (
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
            <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Metadatos Personalizados
            </span>
            {customMetadata.map((m, index) => (
              <div key={m.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="w-full sm:w-1/3">
                  <TextField
                    label={`Clave #${index + 1}`}
                    value={m.key}
                    onChange={(val) => setCustomMetaField(m.id, 'key', val)}
                    placeholder="ej. twitter_url"
                    disabled={isSending}
                  />
                </div>
                <div className="w-full sm:flex-1">
                  <TextField
                    label="Valor"
                    labelEnd={
                      <LockToggle
                        locked={m.locked}
                        onToggle={() => toggleCustomMetaLock(m.id)}
                        label={labels.lock}
                        hint={labels.lockHint}
                        disabled={isSending}
                      />
                    }
                    value={m.value}
                    onChange={(val) => setCustomMetaField(m.id, 'value', val)}
                    placeholder="Valor del metadato"
                    disabled={isSending}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomMeta(m.id)}
                  disabled={isSending}
                  className="mb-[2px] p-2 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title={labels.remove}
                >
                  <Trash2 className="size-4.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addCustomMeta}
          disabled={isSending}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer disabled:opacity-50"
          style={{ color: 'var(--color-primary)' }}
        >
          <Plus className="size-3.5" />
          Añadir campo personalizado
        </button>
      </ToolSection>

      <ToolSection title={common.ownerRole}>
        <OwnerRoleSelector
          t={common}
          holdings={holdings}
          value={ownerRole}
          onChange={setOwnerRole}
          disabled={isSending}
        />
        {tokenType === 'nonFungible' && (
          <button
            type="button"
            onClick={applyBadgePreset}
            disabled={isSending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer disabled:opacity-50"
            style={{ color: 'var(--color-primary)' }}
          >
            <BadgePlus className="size-3.5" />
            {common.createNewBadge}
          </button>
        )}
      </ToolSection>

      <ToolSection title={labels.authRoles} hint={labels.authRolesHint}>
        <button
          type="button"
          onClick={() => setShowAuthRoles((prev) => !prev)}
          aria-expanded={showAuthRoles}
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer"
          style={{ color: 'var(--color-primary)' }}
        >
          <ChevronDown className={`size-3.5 transition-transform ${showAuthRoles ? 'rotate-180' : ''}`} />
          {labels.authRoles}
        </button>
        {showAuthRoles && (
          <div className="divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
            {AUTH_ROLE_PAIRS.flatMap(({ setter, updater, nftOnly, setterOptions }) => {
              if (nftOnly && tokenType !== 'nonFungible') return [];
              return [
                <AuthRoleRow
                  key={setter}
                  roleKey={setter}
                  roleHint={authRoleHints[setter]}
                  value={authRoles[setter]}
                  onChange={(value) => setAuthRoles((prev) => ({ ...prev, [setter]: value }))}
                  options={setterOptions ?? ['owner', 'denyAll', 'allowAll']}
                  labels={authRoleLabels}
                  optionHints={authRoleOptionHints}
                  disabled={isSending}
                />,
                <AuthRoleRow
                  key={updater}
                  roleKey={updater}
                  roleHint={authRoleHints[updater]}
                  value={authRoles[updater]}
                  onChange={(value) => setAuthRoles((prev) => ({ ...prev, [updater]: value }))}
                  options={['owner', 'denyAll', 'allowAll']}
                  labels={authRoleLabels}
                  optionHints={authRoleOptionHints}
                  disabled={isSending}
                />,
              ];
            })}
          </div>
        )}
      </ToolSection>

      {tokenType === 'nonFungible' && (
        <ToolSection title={labels.nfts}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nfts.map((nft, index) => (
              <div
                key={nft.id}
                className="rounded-2xl border p-4 space-y-3"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}
              >
                <div
                  className="flex items-center justify-between pb-2 border-b"
                  style={{ borderColor: 'var(--color-card-border)' }}
                >
                  <span className="text-xs font-bold" style={{ color: 'var(--color-text-main)' }}>
                    #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNft(nft.id)}
                    disabled={isSending}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold transition-colors hover:text-red-500 cursor-pointer"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Trash2 className="size-3" />
                    {labels.remove}
                  </button>
                </div>
                <TextField
                  label={labels.nftName}
                  value={nft.data.name}
                  onChange={(value) => setNftField(nft.id, 'name', value)}
                  disabled={isSending}
                />
                <TextField
                  label={labels.nftDescription}
                  value={nft.data.description}
                  onChange={(value) => setNftField(nft.id, 'description', value)}
                  disabled={isSending}
                />
                <TextField
                  label={labels.nftImageUrl}
                  value={nft.data.key_image_url}
                  onChange={(value) => setNftField(nft.id, 'key_image_url', value)}
                  disabled={isSending}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => addNft()}
              disabled={isSending}
              className="rounded-2xl border-2 border-dashed min-h-32 flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50"
              style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}
            >
              <Plus className="size-4" />
              {labels.addNft}
            </button>
          </div>
        </ToolSection>
      )}

      <TxResultBanner
        t={common}
        result={result}
        error={error}
        createdEntityLabel={labels.successResource}
        onReset={reset}
      />

      <SendToWalletButton
        onClick={handleSend}
        disabled={!canSend}
        loading={isSending}
        label={common.sendToWallet}
        loadingLabel={common.sending}
      />
    </div>
  );
}
