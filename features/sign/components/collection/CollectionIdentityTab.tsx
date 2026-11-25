'use client';

import { useState } from 'react';
import { BadgeCheck, Layers } from 'lucide-react';
import { RadixIcon } from '@/components/shared/RadixIcon';
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
import { truncateAddress } from '@/utils/formatters';
import {
  ICON_URL_KEY,
  ORG_NAME_KEY,
  ORG_URL_KEY,
} from '../../constants/seal';
import { useDomainVerification } from '../../hooks/useDomainVerification';
import {
  useCollectionProfile,
  useSealRequest,
} from '../../hooks/useSealRequest';
import {
  MAX_SYMBOL_LENGTH,
  sanitizeSymbol,
} from '../../lib/nf-manifest-helpers';
import { buildCollectionMetadataManifest } from '../../lib/sign-request';
import type { SignDictionary } from '../../types/dictionary';
import { SignErrorText } from '../SignErrorText';
import {
  LockBadge,
  StokenetFillButton,
  type CollectionLabels,
  type ProfileKey,
  type SealSetupState,
} from './CollectionPrimitives';
import {
  DomainStatusButton,
  DomainVerificationDrawer,
} from './DomainVerificationDrawer';
import { generateStokenetCollectionSample } from './stokenetSample';

const LEDGER_KEY: Record<ProfileKey, string> = {
  name: 'name',
  symbol: 'symbol',
  iconUrl: ICON_URL_KEY,
  orgName: ORG_NAME_KEY,
  orgUrl: ORG_URL_KEY,
};

export function CollectionIdentityTab({
  labels,
  t,
  consoleT,
  account,
  setup,
}: {
  labels: CollectionLabels;
  t: SignDictionary;
  consoleT: ConsoleDictionary;
  account: string | null;
  setup: SealSetupState;
}) {
  const { activeNetworkId } = useRadixWallet();
  const isStokenet = activeNetworkId === RadixNetworkId.Stokenet;
  const collection = setup.collection;
  const { profile, refetch } = useCollectionProfile(
    collection?.resourceAddress ?? null,
  );
  const { updateCollectionMetadata, phase, error } = useSealRequest();
  const preview = useTransactionPreview();
  const [edits, setEdits] = useState<Partial<Record<ProfileKey, string>>>({});
  const [saved, setSaved] = useState(false);
  const [domainDrawerOpen, setDomainDrawerOpen] = useState(false);

  const busy = phase === 'creating';
  const entries = profile?.entries ?? [];
  const lockedKeys = new Set(entries.filter((e) => e.locked).map((e) => e.key));
  const isLocked = (key: ProfileKey) => lockedKeys.has(LEDGER_KEY[key]);

  const otherEntries = entries
    .filter((entry) => !Object.values(LEDGER_KEY).includes(entry.key))
    .sort((a, b) => a.key.localeCompare(b.key));

  const value = (key: ProfileKey) => edits[key] ?? profile?.[key] ?? '';
  const setValue = (key: ProfileKey, next: string) => {
    setSaved(false);
    setEdits((prev) => ({ ...prev, [key]: next }));
  };
  const changed = (key: ProfileKey) =>
    edits[key] !== undefined && edits[key] !== (profile?.[key] ?? '')
      ? edits[key]
      : undefined;

  const domainCheck = useDomainVerification({
    orgUrl: value('orgUrl'),
    collection: collection?.resourceAddress ?? null,
    account,
  });
  const isDomainVerified =
    !!domainCheck.result?.verified &&
    domainCheck.result.domain === domainCheck.domain;

  if (!collection || !setup.seal) {
    return (
      <ToolSection title={labels.identity.title}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {labels.identity.noCollection}
        </p>
      </ToolSection>
    );
  }

  const pendingEdits = () => ({
    name: changed('name'),
    symbol: changed('symbol'),
    iconUrl: changed('iconUrl'),
    orgName: changed('orgName'),
    orgUrl: changed('orgUrl'),
  });

  const onSimulate = () => {
    if (!account || !setup.seal) return;
    const manifest = buildCollectionMetadataManifest({
      account,
      sealGlobalId: setup.seal.globalId,
      collection: collection.resourceAddress,
      ...pendingEdits(),
    });
    if (manifest) preview.simulate(manifest);
  };

  const onSave = async () => {
    if (!account || !setup.seal) return;
    const ok = await updateCollectionMetadata({
      account,
      sealGlobalId: setup.seal.globalId,
      collection: collection.resourceAddress,
      ...pendingEdits(),
    });
    if (ok) {
      setSaved(true);
      setEdits({});
      void refetch();
      void setup.refetch();
    }
  };

  const fillStokenetTestData = () => {
    const sample = generateStokenetCollectionSample(
      typeof window !== 'undefined' ? window.location.origin : undefined,
    );
    setSaved(false);
    const next: Partial<Record<ProfileKey, string>> = {};
    if (!isLocked('name')) next.name = sample.name;
    if (!isLocked('symbol')) next.symbol = sample.symbol;
    if (!isLocked('orgName')) next.orgName = sample.orgName;
    if (!isLocked('orgUrl')) next.orgUrl = sample.orgUrl;
    if (!isLocked('iconUrl') && sample.logoUrl) next.iconUrl = sample.logoUrl;
    setEdits(next);
  };

  return (
    <div className="space-y-6">
      <ToolSection
        title={labels.identity.title}
        hint={labels.identity.hint}
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
        <div className="flex flex-wrap items-center gap-2">
          <Layers
            className="size-3.5"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <span
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {labels.identity.editing}
          </span>
          <span
            className="font-mono text-xs"
            style={{ color: 'var(--color-text-main)' }}
            title={collection.resourceAddress}
          >
            {truncateAddress(collection.resourceAddress)}
          </span>
          <DomainStatusButton
            verified={isDomainVerified}
            checking={domainCheck.checking}
            verifiedLabel={labels.identity.domainVerify.verifiedBadge}
            unverifiedLabel={labels.identity.domainVerify.unverifiedBadge}
            checkingLabel={labels.identity.domainVerify.checkingBadge}
            title={labels.identity.domainVerify.badgeTooltip}
            onClick={() => setDomainDrawerOpen(true)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              ['name', labels.create.nameLabel, undefined, undefined],
              ['symbol', labels.create.symbolLabel, undefined, undefined],
              [
                'orgName',
                labels.identity.orgNameLabel,
                labels.identity.orgNameHint,
                undefined,
              ],
              ['orgUrl', labels.identity.orgUrlLabel, undefined, labels.identity.urlPlaceholder],
              [
                'iconUrl',
                labels.identity.logoLabel,
                labels.identity.logoHint,
                labels.identity.urlPlaceholder,
              ],
            ] as [ProfileKey, string, string | undefined, string | undefined][]
          ).map(([key, label, hint, placeholder]) => {
            const locked = isLocked(key);
            return (
              <TextField
                key={key}
                label={label}
                hint={hint}
                placeholder={placeholder}
                value={value(key)}
                onChange={(v) =>
                  setValue(key, key === 'symbol' ? sanitizeSymbol(v) : v)
                }
                maxLength={key === 'symbol' ? MAX_SYMBOL_LENGTH : undefined}
                disabled={busy || locked}
                labelEnd={
                  <LockBadge
                    locked={locked}
                    lockedLabel={labels.identity.lockedBadge}
                    editableLabel={labels.identity.editableBadge}
                  />
                }
              />
            );
          })}
        </div>

        {otherEntries.length > 0 && (
          <div className="space-y-2">
            <p
              className="text-xs font-semibold"
              style={{ color: 'var(--color-text-main)' }}
            >
              {labels.identity.otherTitle}
            </p>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {labels.identity.otherHint}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {otherEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="rounded-xl border p-3 space-y-1"
                  style={{ borderColor: 'var(--color-card-border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="font-mono text-[11px] truncate"
                      style={{ color: 'var(--color-text-muted)' }}
                      title={entry.key}
                    >
                      {entry.key}
                    </span>
                    <LockBadge
                      locked={entry.locked}
                      lockedLabel={labels.identity.lockedBadge}
                      editableLabel={labels.identity.editableBadge}
                    />
                  </div>
                  <p
                    className="text-sm break-words"
                    style={{ color: 'var(--color-text-main)' }}
                  >
                    {entry.value || '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p
          className="text-xs leading-relaxed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {labels.identity.lockedNote}
        </p>

        {error && (
          <p className="text-xs font-medium text-[var(--color-danger)]">
            <SignErrorText t={t} code={error} />
          </p>
        )}
        {saved && (
          <p
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            <BadgeCheck className="size-4" />
            {labels.identity.saved}
          </p>
        )}
      </ToolSection>

      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {labels.identity.saveHint}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy || Object.keys(edits).length === 0}
          onClick={() => void onSave()}
          className="flex w-full items-center justify-center gap-2 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
        >
          {busy ? (
            <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <RadixIcon
              className="size-4"
              strokeColor="currentColor"
              animate={false}
            />
          )}
          {busy ? labels.identity.saving : labels.identity.save}
        </button>
        <SimulateButton
          t={consoleT.simulate}
          onClick={onSimulate}
          disabled={busy || Object.keys(edits).length === 0}
          loading={preview.isSimulating}
        />
      </div>
      <SimulateResultCard
        t={consoleT.simulate}
        preview={preview.preview}
        error={preview.error}
        onClose={preview.reset}
      />

      <DomainVerificationDrawer
        isOpen={domainDrawerOpen}
        onClose={() => setDomainDrawerOpen(false)}
        labels={labels.identity.domainVerify}
        collection={collection.resourceAddress}
        domain={domainCheck.domain}
        result={domainCheck.result}
        checking={domainCheck.checking}
        error={domainCheck.error}
        onCheckNow={() => void domainCheck.refetch()}
      />
    </div>
  );
}
