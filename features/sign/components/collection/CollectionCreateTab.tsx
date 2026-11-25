'use client';

import { useState } from 'react';
import {
  BadgeCheck,
  Check,
  Lock,
  LockOpen,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { OptionButtons } from '@/features/console/components/shared/OptionButtons';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { TextField } from '@/features/console/components/shared/fields';
import { useNftData } from '@/features/console/hooks/useNftData';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { radixSealAddress, sealImageUrl } from '../../constants/seal';
import { useSealRequest } from '../../hooks/useSealRequest';
import { splitNftGlobalId } from '../../lib/network';
import {
  MAX_SYMBOL_LENGTH,
  sanitizeSymbol,
} from '../../lib/nf-manifest-helpers';
import {
  buildProvisionPreviewManifest,
  isReservedCollectionMetadataKey,
  MAX_COLLECTION_META_FIELDS,
  type CollectionMetaField,
} from '../../lib/sign-request';
import type { SignDictionary } from '../../types/dictionary';
import { SignErrorText } from '../SignErrorText';
import {
  StokenetFillButton,
  shortLocalId,
  type CollectionLabels,
  type SealItem,
} from './CollectionPrimitives';
import { generateStokenetCollectionSample } from './stokenetSample';

interface CustomMetaField extends CollectionMetaField {
  id: string;
}

export function CollectionCreateTab({
  labels,
  t,
  consoleT,
  account,
  seals,
  hasCollections,
  onCreated,
}: {
  labels: CollectionLabels;
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  account: string | null;
  seals: SealItem[];
  hasCollections: boolean;
  onCreated: (resourceAddress: string) => void;
}) {
  const { provisionCollection, createCollection, phase, error } = useSealRequest();
  const { activeNetworkId } = useRadixWallet();
  const preview = useTransactionPreview();

  const [sealGlobalId, setSealGlobalId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgUrl, setOrgUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [newSeal, setNewSeal] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [customMeta, setCustomMeta] = useState<CustomMetaField[]>([]);

  const addCustomMeta = () =>
    setCustomMeta((prev) =>
      prev.length >= MAX_COLLECTION_META_FIELDS
        ? prev
        : [
            ...prev,
            { id: crypto.randomUUID(), key: '', value: '', locked: false },
          ],
    );
  const removeCustomMeta = (id: string) =>
    setCustomMeta((prev) => prev.filter((field) => field.id !== id));
  const setCustomMetaField = (id: string, part: 'key' | 'value', value: string) =>
    setCustomMeta((prev) =>
      prev.map((field) => (field.id === id ? { ...field, [part]: value } : field)),
    );
  const toggleCustomMetaLock = (id: string) =>
    setCustomMeta((prev) =>
      prev.map((field) =>
        field.id === id ? { ...field, locked: !field.locked } : field,
      ),
    );

  const metaFields = (): CollectionMetaField[] =>
    customMeta
      .filter(
        (field) =>
          field.key.trim() &&
          field.value.trim() &&
          !isReservedCollectionMetadataKey(field.key),
      )
      .map(({ key, value, locked }) => ({
        key: key.trim(),
        value: value.trim(),
        locked,
      }));

  const busy = phase === 'minting-seal' || phase === 'creating-collection';
  const isStokenet = activeNetworkId === RadixNetworkId.Stokenet;

  const fillStokenetTestData = () => {
    const sample = generateStokenetCollectionSample(
      typeof window !== 'undefined' ? window.location.origin : undefined,
    );
    setCreated(null);
    setName(sample.name);
    setSymbol(sample.symbol);
    setOrgName(sample.orgName);
    setOrgUrl(sample.orgUrl);
    setLogoUrl(sample.logoUrl);
    setCustomMeta(
      sample.customMetadata.map((entry) => ({
        id: crypto.randomUUID(),
        ...entry,
      })),
    );
  };
  const sealResource = seals[0]
    ? splitNftGlobalId(seals[0].globalId).resource
    : null;
  const { data: sealData } = useNftData(
    sealResource,
    seals.map((seal) => seal.localId),
  );

  const chosenSeal =
    seals.find((s) => s.globalId === sealGlobalId) ?? seals[0] ?? null;
  const imageUrl =
    logoUrl.trim() ||
    (typeof window !== 'undefined' ? sealImageUrl(window.location.origin) : '');

  const issuerMeta = () =>
    orgName.trim() || orgUrl.trim() || logoUrl.trim()
      ? {
          orgName: orgName.trim(),
          orgWebsite: orgUrl.trim(),
          orgLogoUrl: logoUrl.trim() || undefined,
        }
      : undefined;

  const onSimulate = () => {
    if (!account || activeNetworkId == null) return;
    const manifest = buildProvisionPreviewManifest({
      account,
      networkId: activeNetworkId,
      sealResource: radixSealAddress(activeNetworkId),
      sealGlobalId: !newSeal && chosenSeal ? chosenSeal.globalId : null,
      collectionName: name.trim(),
      symbol: symbol.trim() || undefined,
      imageUrl,
      issuer: issuerMeta(),
      extraMetadata: metaFields(),
    });
    if (manifest) preview.simulate(manifest);
  };

  const onSubmit = async () => {
    if (!account) return;
    const issuer = issuerMeta();
    const extraMetadata = metaFields();
    const resource =
      chosenSeal && !newSeal
        ? await createCollection({
            account,
            sealGlobalId: chosenSeal.globalId,
            collectionName: name.trim(),
            symbol: symbol.trim() || undefined,
            imageUrl,
            issuer,
            extraMetadata,
          })
        : await provisionCollection({
            account,
            existingSeal: null,
            forceNewSeal: newSeal,
            collectionName: name.trim(),
            symbol: symbol.trim() || undefined,
            imageUrl,
            issuer,
            extraMetadata,
          });
    if (resource) {
      setCreated(resource);
      onCreated(resource);
    }
  };

  return (
    <div className="space-y-6">
      {hasCollections && (
        <div
          className="flex gap-3 rounded-2xl border px-4 py-3"
          style={{
            borderColor: 'var(--color-warning, #eab308)',
            background: 'var(--color-surface)',
          }}
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            style={{ color: 'var(--color-warning, #eab308)' }}
          />
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {labels.create.duplicateWarning}
          </p>
        </div>
      )}

      <ToolSection
        title={labels.create.title}
        hint={labels.create.hint}
        action={
          isStokenet ? (
            <StokenetFillButton
              labels={labels.stokenetFill}
              disabled={busy}
              onClick={fillStokenetTestData}
            />
          ) : undefined
        }
      >
        {seals.length > 0 && (
          <div className="space-y-2">
            <p
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {labels.create.sealModeLabel}
            </p>
            <OptionButtons<'reuse' | 'new'>
              value={newSeal ? 'new' : 'reuse'}
              onChange={(mode) => setNewSeal(mode === 'new')}
              disabled={busy}
              layout="grid"
              className="grid-cols-1 sm:grid-cols-2"
              options={[
                {
                  value: 'reuse',
                  label: labels.create.reuseSeal,
                  description: labels.create.reuseSealHint,
                  icon: <BadgeCheck className="size-4" />,
                },
                {
                  value: 'new',
                  label: labels.create.newSeal,
                  description: labels.create.newSealHint,
                  icon: <Plus className="size-4" />,
                },
              ]}
            />
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {newSeal ? labels.create.newSealNote : labels.create.reuseSealNote}
            </p>
          </div>
        )}
        {seals.length > 1 && (
          <div className="space-y-2">
            <p
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {labels.create.sealLabel}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {seals.map((seal) => {
                const data = sealData?.find((d) => d.id === seal.localId);
                const isChosen =
                  !newSeal && chosenSeal?.globalId === seal.globalId;
                return (
                  <button
                    key={seal.globalId}
                    type="button"
                    disabled={newSeal || busy}
                    onClick={() => setSealGlobalId(seal.globalId)}
                    title={seal.localId}
                    className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all enabled:cursor-pointer enabled:hover:border-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      borderColor: isChosen
                        ? 'var(--color-primary)'
                        : 'var(--color-card-border)',
                      background: isChosen
                        ? 'rgba(var(--color-primary-rgb), 0.08)'
                        : 'var(--color-surface)',
                    }}
                  >
                    <SafeImage
                      src={data?.imageUrl}
                      alt={data?.name || labels.seals.title}
                      fallbackName={data?.name || 'Radix Seal'}
                      className="size-11 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-bold"
                        style={{
                          color: isChosen
                            ? 'var(--color-primary)'
                            : 'var(--color-text-main)',
                        }}
                      >
                        {data?.name || labels.seals.title}
                      </span>
                      <span
                        className="block truncate font-mono text-[11px]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {shortLocalId(seal.localId)}
                      </span>
                    </span>
                    {isChosen && (
                      <Check
                        className="size-4 shrink-0"
                        style={{ color: 'var(--color-primary)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {seals.length === 0 && (
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {labels.create.noSealNote}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            label={labels.create.nameLabel}
            hint={labels.create.nameHint}
            value={name}
            onChange={setName}
            disabled={busy}
          />
          <TextField
            label={labels.create.symbolLabel}
            hint={labels.create.symbolHint}
            value={symbol}
            onChange={(value) => setSymbol(sanitizeSymbol(value))}
            maxLength={MAX_SYMBOL_LENGTH}
            disabled={busy}
          />
          <TextField
            label={labels.identity.orgNameLabel}
            hint={labels.identity.orgNameHint}
            value={orgName}
            onChange={setOrgName}
            disabled={busy}
          />
          <TextField
            label={labels.identity.orgUrlLabel}
            placeholder="https://…"
            value={orgUrl}
            onChange={setOrgUrl}
            disabled={busy}
          />
          <TextField
            label={labels.identity.logoLabel}
            hint={labels.create.logoHint}
            placeholder="https://…"
            value={logoUrl}
            onChange={setLogoUrl}
            disabled={busy}
          />
        </div>

        <CustomMetadataFields
          labels={labels}
          fields={customMeta}
          disabled={busy}
          onAdd={addCustomMeta}
          onRemove={removeCustomMeta}
          onChange={setCustomMetaField}
          onToggleLock={toggleCustomMetaLock}
        />

        {error && (
          <p className="text-xs font-medium text-[var(--color-danger)]">
            <SignErrorText t={t} code={error} />
          </p>
        )}
        {created && (
          <p
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            <BadgeCheck className="size-4" />
            {labels.create.done}
          </p>
        )}
      </ToolSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy || !account}
          onClick={() => void onSubmit()}
          className="flex w-full items-center justify-center gap-2 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          {busy ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {busy ? labels.create.working : labels.create.button}
        </button>
        <SimulateButton
          t={consoleT.simulate}
          onClick={onSimulate}
          disabled={busy || !account}
          loading={preview.isSimulating}
        />
      </div>
      <SimulateResultCard
        t={consoleT.simulate}
        preview={preview.preview}
        error={preview.error}
        onClose={preview.reset}
      />
    </div>
  );
}

function CustomMetadataFields({
  labels,
  fields,
  disabled,
  onAdd,
  onRemove,
  onChange,
  onToggleLock,
}: {
  labels: CollectionLabels;
  fields: CustomMetaField[];
  disabled: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: (id: string, part: 'key' | 'value', value: string) => void;
  onToggleLock: (id: string) => void;
}) {
  return (
    <div
      className="space-y-3 pt-4 border-t"
      style={{ borderColor: 'var(--color-card-border)' }}
    >
      <div className="space-y-1">
        <span
          className="block text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {labels.create.customTitle}
        </span>
        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {labels.create.customHint}
        </p>
      </div>

      {fields.map((field, index) => {
        const reserved =
          !!field.key.trim() && isReservedCollectionMetadataKey(field.key);
        return (
          <div
            key={field.id}
            className="flex flex-col sm:flex-row gap-3 items-start sm:items-end"
          >
            <div className="w-full sm:w-1/3">
              <TextField
                label={labels.create.customKey.replace(
                  '#{index}',
                  String(index + 1),
                )}
                value={field.key}
                onChange={(value) => onChange(field.id, 'key', value)}
                placeholder={labels.create.customKeyPlaceholder}
                error={reserved ? labels.create.customReserved : undefined}
                maxLength={64}
                disabled={disabled}
              />
            </div>
            <div className="w-full sm:flex-1">
              <TextField
                label={labels.create.customValue}
                labelEnd={
                  <button
                    type="button"
                    onClick={() => onToggleLock(field.id)}
                    disabled={disabled}
                    title={labels.create.customLockHint}
                    aria-pressed={field.locked}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors cursor-pointer disabled:opacity-50"
                    style={{
                      borderColor: field.locked
                        ? 'var(--color-primary)'
                        : 'var(--color-card-border)',
                      color: field.locked
                        ? 'var(--color-primary)'
                        : 'var(--color-text-muted)',
                      background: field.locked
                        ? 'rgba(var(--color-primary-rgb), 0.08)'
                        : 'transparent',
                    }}
                  >
                    {field.locked ? (
                      <Lock className="size-3" />
                    ) : (
                      <LockOpen className="size-3" />
                    )}
                    {labels.create.customLock}
                  </button>
                }
                value={field.value}
                onChange={(value) => onChange(field.id, 'value', value)}
                placeholder={labels.create.customValuePlaceholder}
                maxLength={256}
                disabled={disabled}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(field.id)}
              disabled={disabled}
              title={labels.create.customRemove}
              className="mb-[2px] p-2 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="size-4.5" />
            </button>
          </div>
        );
      })}

      {fields.length < MAX_COLLECTION_META_FIELDS && (
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer disabled:opacity-50"
          style={{ color: 'var(--color-primary)' }}
        >
          <Plus className="size-3.5" />
          {labels.create.customAdd}
        </button>
      )}
    </div>
  );
}
