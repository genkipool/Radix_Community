'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, FileSignature, RefreshCw, Stamp } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { AccountPicker } from '@/features/console/components/shared/AccountPicker';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import { useSealRequest, useSealSetup } from '../hooks/useSealRequest';
import { buildSignCollectionCreateManifest } from '../lib/sign-request';
import { radixSealAddress, sealImageUrl } from '../constants/seal';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { SignDictionary } from '../types/dictionary';
import type { ConsoleDictionary } from '@/features/console/types/i18n.types';
import type { IssuerMeta } from '../types/sign.types';

type SealSetup = ReturnType<typeof useSealSetup>;

/**
 * One-time onboarding for on-ledger signing, shown FIRST in the advanced tab
 * until the selected account owns its Seal and its signing collection. It
 * explains what each NFT is and how it behaves; once both exist the parent
 * stops rendering it forever.
 */
export function SealOnboarding({
  t,
  account,
  onAccountChange,
  setup,
  lockedAccount = false,
  consoleT,
}: {
  t: SignDictionary;
  account: string | null;
  onAccountChange: (account: string) => void;
  setup: SealSetup;
  /** Hide the account picker: the acting account is fixed (e.g. an anchoring
      signer that must be one of the certificate's signers). */
  lockedAccount?: boolean;
  /** Console dictionary; when given, the collection step gains a simulate
      button that dry-runs the create-collection manifest before sending it. */
  consoleT?: ConsoleDictionary;
}) {
  const { activeNetworkId } = useRadixWallet();
  const { mintSeal, createCollection, phase, error } = useSealRequest();
  const collectionPreview = useTransactionPreview();
  const [orgName, setOrgName] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');

  const busy = phase === 'minting-seal' || phase === 'creating-collection';
  const sealDeployed = !!activeNetworkId && !!radixSealAddress(activeNetworkId);
  const nftImage =
    typeof window !== 'undefined' ? sealImageUrl(window.location.origin) : '';

  const issuer: IssuerMeta | undefined =
    orgName.trim() || orgWebsite.trim() || orgLogoUrl.trim()
      ? {
          orgName: orgName.trim() || undefined,
          orgWebsite: orgWebsite.trim() || undefined,
          orgLogoUrl: orgLogoUrl.trim() || undefined,
        }
      : undefined;

  const errorMsg = error
    ? ((t.errors as Record<string, string>)[error] ?? t.errors.generic)
    : '';

  const onMintSeal = async () => {
    if (!account) return;
    const ok = await mintSeal({ account, imageUrl: nftImage });
    if (ok) setup.refetch();
  };

  const onCreateCollection = async () => {
    if (!account || !setup.seal) return;
    const created = await createCollection({
      account,
      // The collection is named after the user/company alone — no branding
      // suffix. It stays editable later by the seal holder anyway.
      sealGlobalId: setup.seal.globalId,
      collectionName: issuer?.orgName ?? 'Signing collection',
      imageUrl: issuer?.orgLogoUrl ?? nftImage,
      issuer,
    });
    if (created) setup.refetch();
  };

  // Dry-run the SAME manifest onCreateCollection submits, before sending it.
  const onSimulateCollection = () => {
    if (!account || !setup.seal || activeNetworkId == null) return;
    collectionPreview.simulate(
      buildSignCollectionCreateManifest({
        account,
        sealGlobalId: setup.seal.globalId,
        sealAddress: radixSealAddress(activeNetworkId),
        networkId: activeNetworkId,
        collectionName: issuer?.orgName ?? 'Signing collection',
        imageUrl: issuer?.orgLogoUrl ?? nftImage,
        issuer,
      }),
    );
  };

  return (
    <div
      className="space-y-4 rounded-2xl border p-5"
      style={{ borderColor: 'var(--color-primary)', background: 'var(--color-card-bg)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]">
          <Stamp className="size-4.5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
            {t.onboarding.title}
          </h3>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t.onboarding.subtitle}
          </p>
        </div>
      </div>

      {/* What these NFTs are and how they behave */}
      <div
        className="rounded-xl border p-3.5 space-y-2 text-xs leading-relaxed"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-card-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <p>
          <strong style={{ color: 'var(--color-text-main)' }}>
            {t.onboarding.sealTitle}
          </strong>{' '}
          {t.onboarding.sealBody}
        </p>
        <p>
          <strong style={{ color: 'var(--color-text-main)' }}>
            {t.onboarding.collectionTitle}
          </strong>{' '}
          {t.onboarding.collectionBody}
        </p>
        <p>
          <strong style={{ color: 'var(--color-text-main)' }}>
            {t.onboarding.invitesTitle}
          </strong>{' '}
          {t.onboarding.invitesBody}
        </p>
        <p>{t.onboarding.caNote}</p>
      </div>

      {!lockedAccount && (
        <ToolSection title={t.onchain.account}>
          <AccountPicker value={account} onChange={onAccountChange} disabled={busy} />
        </ToolSection>
      )}

      {/* Step 1: the seal */}
      <StepRow
        index={1}
        done={!!setup.seal}
        loading={setup.loading && !setup.ready}
        label={t.onchain.sealStep}
        doneLabel={t.onchain.sealOk}
      >
        {!sealDeployed ? (
          <Muted text={t.onchain.sealNotDeployed} />
        ) : (
          <>
            <Muted text={t.onchain.sealMissing} />
            <button
              type="button"
              disabled={busy || !account}
              onClick={onMintSeal}
              className="flex items-center gap-2 px-5 h-10 rounded-full font-bold text-xs text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              {phase === 'minting-seal' ? (
                <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <Stamp className="size-3.5" />
              )}
              {phase === 'minting-seal' ? t.onchain.sealMinting : t.onchain.sealGet}
            </button>
          </>
        )}
      </StepRow>

      {/* Step 2: the collection */}
      <StepRow
        index={2}
        done={!!setup.collection}
        loading={setup.loading && !setup.ready}
        blocked={!setup.seal}
        label={t.onchain.collectionStep}
        doneLabel={t.onchain.collectionOk}
      >
        <Muted text={t.onchain.collectionMissing} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledInput
            label={t.onchain.orgName}
            value={orgName}
            onChange={setOrgName}
            placeholder={t.onchain.orgNamePlaceholder}
            disabled={busy}
          />
          <LabeledInput
            label={t.onchain.orgWebsite}
            value={orgWebsite}
            onChange={setOrgWebsite}
            placeholder="https://…"
            disabled={busy}
          />
        </div>
        <LabeledInput
          label={t.onchain.orgLogo}
          value={orgLogoUrl}
          onChange={setOrgLogoUrl}
          placeholder="https://…/logo.png"
          disabled={busy}
        />
        <Muted text={t.onchain.issuerHint} />
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={busy || !setup.seal}
            onClick={onCreateCollection}
            className="flex flex-1 items-center justify-center gap-2 px-5 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            {phase === 'creating-collection' ? (
              <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <FileSignature className="size-3.5" />
            )}
            {phase === 'creating-collection'
              ? t.onchain.collectionCreating
              : t.onchain.collectionCreate}
          </button>
          {consoleT && (
            <SimulateButton
              t={consoleT.simulate}
              onClick={onSimulateCollection}
              disabled={busy || !setup.seal}
              loading={collectionPreview.isSimulating}
            />
          )}
        </div>
        {consoleT && (
          <SimulateResultCard
            t={consoleT.simulate}
            preview={collectionPreview.preview}
            error={collectionPreview.error}
            onClose={collectionPreview.reset}
          />
        )}
      </StepRow>

      {errorMsg && (
        <p className="text-sm" style={{ color: 'var(--color-danger, #dc2626)' }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}

function StepRow({
  index,
  done,
  loading,
  blocked = false,
  label,
  doneLabel,
  children,
}: {
  index: number;
  done: boolean;
  loading: boolean;
  blocked?: boolean;
  label: string;
  doneLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-3.5 space-y-2"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-card-border)',
        opacity: blocked ? 0.5 : 1,
      }}
    >
      <p
        className="flex items-center gap-2 text-xs font-bold"
        style={{ color: 'var(--color-text-main)' }}
      >
        {done ? (
          <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
        ) : loading ? (
          <RefreshCw className="size-4 shrink-0 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        ) : (
          <Circle className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        )}
        {index}. {done ? doneLabel : label}
      </p>
      {!done && !loading && !blocked && (
        <div className="space-y-2 pl-6">{children}</div>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={200}
        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{
          background: 'var(--color-input-bg, var(--color-card-bg))',
          borderColor: 'var(--color-card-border)',
          color: 'var(--color-text-main)',
        }}
      />
    </label>
  );
}

function Muted({ text }: { text: string }) {
  return (
    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
      {text}
    </p>
  );
}
