'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, FileSignature, Info, RefreshCw, Stamp } from 'lucide-react';
import { ToolSection } from '@/features/console/components/shared/ToolSection';
import { AccountPicker } from '@/features/console/components/shared/AccountPicker';
import {
  SimulateButton,
  SimulateResultCard,
} from '@/features/console/components/shared/SimulatePanel';
import { useTransactionPreview } from '@/features/console/hooks/useTransactionPreview';
import { useSealRequest, useSealSetup } from '../hooks/useSealRequest';
import { buildSignCollectionCreateManifest } from '../lib/sign-request';
import { buildSealMintManifest } from '../lib/radix-seal-manifest';
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
  const { provisionCollection, phase, error } = useSealRequest();
  const collectionPreview = useTransactionPreview();
  const [orgName, setOrgName] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [symbol, setSymbol] = useState('');

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

  // One click: mint the seal (if missing) and then create the collection. When
  // the seal is missing this sends TWO wallet transactions back to back.
  const onProvision = async () => {
    if (!account) return;
    await provisionCollection({
      account,
      existingSeal: setup.seal,
      // The collection is named after the user/company alone — no branding
      // suffix. It stays editable later by the seal holder anyway.
      collectionName: issuer?.orgName ?? 'Signing collection',
      symbol: symbol.trim() || undefined,
      imageUrl: issuer?.orgLogoUrl ?? nftImage,
      issuer,
    });
    // Refetch either way: even on a failed collection step the seal may now
    // exist, so the UI (and a retry) sees it instead of minting a second one.
    setup.refetch();
  };

  // Dry-run the NEXT transaction the button will send: the seal mint when the
  // account has no seal yet, otherwise the collection creation. This keeps the
  // simulate button in lock-step with the create button (both enabled/disabled
  // under the same conditions) and lets the user check either step won't error.
  const onSimulateCollection = () => {
    if (!account || activeNetworkId == null) return;
    const sealResource = radixSealAddress(activeNetworkId);
    if (setup.seal) {
      collectionPreview.simulate(
        buildSignCollectionCreateManifest({
          account,
          sealGlobalId: setup.seal.globalId,
          sealAddress: sealResource,
          networkId: activeNetworkId,
          collectionName: issuer?.orgName ?? 'Signing collection',
          symbol: symbol.trim() || undefined,
          imageUrl: issuer?.orgLogoUrl ?? nftImage,
          issuer,
        }),
      );
    } else if (sealResource) {
      collectionPreview.simulate(
        buildSealMintManifest({ account, sealResource, imageUrl: nftImage }),
      );
    }
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

      {/* Step 1: the seal — minted automatically with the collection below */}
      <StepRow
        index={1}
        done={!!setup.seal}
        loading={setup.loading && !setup.ready}
        label={t.onchain.sealStep}
        doneLabel={t.onchain.sealOk}
      >
        <Muted text={sealDeployed ? t.onchain.sealWithCollection : t.onchain.sealNotDeployed} />
      </StepRow>

      {/* Step 2: the collection (mints the seal too when it is missing) */}
      <StepRow
        index={2}
        done={!!setup.collection}
        loading={setup.loading && !setup.ready}
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
        <LabeledInput
          label={t.onchain.collectionSymbol}
          value={symbol}
          onChange={(v) => setSymbol(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
          placeholder="SEAL"
          disabled={busy}
        />
        <Muted text={t.onchain.issuerHint} />
        {/* When the account has no seal yet, creating the collection sends two
            transactions: the seal first, then the collection. */}
        {!setup.seal && sealDeployed && (
          <p
            className="flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            <Info className="size-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
            {t.onchain.twoTxNote}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={busy || !account || !sealDeployed}
            onClick={onProvision}
            className="flex flex-1 items-center justify-center gap-2 px-5 h-12 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            {busy ? (
              <span className="size-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <FileSignature className="size-3.5" />
            )}
            {phase === 'minting-seal'
              ? t.onchain.sealMinting
              : phase === 'creating-collection'
                ? t.onchain.collectionCreating
                : t.onchain.collectionCreateSelfCustody}
          </button>
          {consoleT && (
            <SimulateButton
              t={consoleT.simulate}
              onClick={onSimulateCollection}
              disabled={busy || !account || !sealDeployed}
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
          <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
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
