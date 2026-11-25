'use client';

import { useState } from 'react';
import { BadgeCheck, Plus, TriangleAlert } from 'lucide-react';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { TextField } from '@/features/console/components/shared/fields';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { radixSealAddress, sealImageUrl } from '../../constants/seal';
import { useSealRequest } from '../../hooks/useSealRequest';
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
  type CollectionLabels,
  type SealItem,
} from './CollectionPrimitives';
import {
  CustomMetadataEditor,
  type CustomMetaField,
} from './CustomMetadataEditor';
import { SealModeSelector } from './SealModeSelector';
import { generateStokenetCollectionSample } from './stokenetSample';

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
  const { provisionCollection, createCollection, phase, error } =
    useSealRequest();
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
  const setCustomMetaField = (
    id: string,
    part: 'key' | 'value',
    value: string,
  ) =>
    setCustomMeta((prev) =>
      prev.map((field) =>
        field.id === id ? { ...field, [part]: value } : field,
      ),
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
        <SealModeSelector
          labels={labels}
          seals={seals}
          chosenSeal={chosenSeal}
          newSeal={newSeal}
          disabled={busy}
          onNewSealChange={setNewSeal}
          onSelectSeal={setSealGlobalId}
        />

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
            placeholder={labels.identity.urlPlaceholder}
            value={orgUrl}
            onChange={setOrgUrl}
            disabled={busy}
          />
          <TextField
            label={labels.identity.logoLabel}
            hint={labels.create.logoHint}
            placeholder={labels.identity.urlPlaceholder}
            value={logoUrl}
            onChange={setLogoUrl}
            disabled={busy}
          />
        </div>

        <CustomMetadataEditor
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
