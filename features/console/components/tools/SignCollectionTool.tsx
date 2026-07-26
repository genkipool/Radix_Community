'use client';

import { useState } from 'react';
import {
  BadgeCheck,
  Check,
  Layers,
  Plus,
  Save,
  TriangleAlert,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import {
  SimulateButton,
  SimulateResultCard,
} from '../shared/SimulatePanel';
import { buildSealMintManifest } from '@/features/sign/lib/radix-seal-manifest';
import {
  buildCollectionMetadataManifest,
  buildSignCollectionCreateManifest,
} from '@/features/sign/lib/sign-request';
import { WalletConnectGate } from '@/features/wallet/components/WalletConnectGate';
import { SafeImage } from '@/components/ui/SafeImage';
import { useNftData } from '../../hooks/useNftData';
import { truncateAddress } from '@/utils/formatters';
import { radixSealAddress, sealImageUrl } from '@/features/sign/constants/seal';
import {
  MAX_SYMBOL_LENGTH,
  sanitizeSymbol,
} from '@/features/sign/lib/nf-manifest-helpers';
import {
  useCollectionProfile,
  useSealRequest,
  useSealSetup,
  useSignCollections,
  useUserSeals,
} from '@/features/sign/hooks/useSealRequest';
import type { SignDictionary } from '@/features/sign/types/dictionary';
import type { ConsoleToolProps } from '../ConsoleToolView';
import { ToolSection } from '../shared/ToolSection';
import { AccountPicker } from '../shared/AccountPicker';
import { OptionButtons } from '../shared/OptionButtons';
import { TextField } from '../shared/fields';

type Tab = 'collections' | 'create' | 'identity';

/**
 * Radix Seal · Collection.
 *
 * The signing model made visible: a soulbound SEAL owns a signing COLLECTION,
 * and every invitation and signature is an NFT inside it. That chain is what
 * makes an on-ledger signature attributable, and until now it had no screen of
 * its own — the collection was created inside the signing tool's onboarding and
 * never mentioned again, its issuer identity could only be set at creation, and
 * an account that ended up with two collections had no way to see or choose.
 *
 * This tool does NOT replace that onboarding: someone with no seal and no
 * collection still gets them from the sign and encrypt tools, in one click,
 * without coming here first.
 */
export default function SignCollectionTool({ t: consoleT }: ConsoleToolProps) {
  const { t: full } = useLanguage();
  const t = full.sign as SignDictionary;
  const labels = t?.collection;
  const { accounts } = useRadixWallet();

  const [tab, setTab] = useState<Tab>('collections');
  const [account, setAccount] = useState<string | null>(null);
  const effectiveAccount = account ?? accounts[0]?.address ?? null;

  const setup = useSealSetup(effectiveAccount);
  const { collections, loading: collectionsLoading, refetch: refetchCollections } =
    useSignCollections(effectiveAccount, true);
  const { seals, refetch: refetchSeals } = useUserSeals(effectiveAccount);
  const [settling, setSettling] = useState(false);

  /**
   * After creating: the list query is cached, and the Gateway needs a moment to
   * index a brand-new resource, so one refetch can still come back without it.
   * Poll until it lands instead of leaving the user to reload the page.
   */
  const showNewCollection = async (resourceAddress: string) => {
    setSettling(true);
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const fresh = await refetchCollections();
        if (fresh.some((c) => c.resourceAddress === resourceAddress)) return;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } finally {
      setSettling(false);
      void refetchSeals();
      void setup.refetch();
    }
  };

  if (!labels) return null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div
        className="flex gap-6 border-b"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        {(
          [
            ['collections', labels.tabs.collections],
            ['create', labels.tabs.create],
            ['identity', labels.tabs.identity],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="relative pb-2.5 text-sm font-bold transition-colors"
            style={{
              color:
                tab === key ? 'var(--color-text-main)' : 'var(--color-text-muted)',
            }}
          >
            {label}
            {tab === key && (
              <span
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                style={{
                  background:
                    'linear-gradient(to right, var(--color-accent), var(--color-primary))',
                }}
              />
            )}
          </button>
        ))}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        <strong style={{ color: 'var(--color-text-main)' }}>{labels.intro.title}.</strong>{' '}
        {labels.intro.body}
      </p>

      <WalletConnectGate
        title={labels.connect.title}
        subtitle={labels.connect.subtitle}
        mainnetLabel={t.connect?.mainnet ?? 'Mainnet'}
        stokenetLabel={t.connect?.stokenet ?? 'Stokenet'}
      >
        <div className="space-y-6">
          <ToolSection title={labels.accountLabel}>
            <AccountPicker value={account} onChange={setAccount} />
          </ToolSection>

          {tab === 'collections' && (
            <CollectionsTab
              labels={labels}
              setup={setup}
              seals={seals}
              collections={collections}
              loading={collectionsLoading || settling}
              onCreate={() => setTab('create')}
            />
          )}
          {tab === 'create' && (
            <CreateTab
              labels={labels}
              t={t}
              consoleT={consoleT}
              account={effectiveAccount}
              seals={seals}
              hasCollections={collections.length > 0}
              onCreated={(resourceAddress) => {
                // Pin the account that just created it: `account` may still be
                // null (nothing picked), in which case the shown one follows
                // accounts[0] and would drift if the wallet re-emits its list
                // in another order.
                if (effectiveAccount) setAccount(effectiveAccount);
                setTab('collections');
                void showNewCollection(resourceAddress);
              }}
            />
          )}
          {tab === 'identity' && (
            <IdentityTab
              labels={labels}
              t={t}
              consoleT={consoleT}
              account={effectiveAccount}
              setup={setup}
            />
          )}
        </div>
      </WalletConnectGate>
    </div>
  );
}

type Labels = NonNullable<SignDictionary['collection']>;
type Setup = ReturnType<typeof useSealSetup>;
type Seal = ReturnType<typeof useUserSeals>['seals'][number];
type Collection = ReturnType<typeof useSignCollections>['collections'][number];
/** The editable metadata keys, shared by the form state and the manifest. */
type ProfileKey = 'name' | 'symbol' | 'iconUrl' | 'orgName' | 'orgUrl';

/** Wallet/ledger failures come back as codes; the sign namespace names them. */
function errorText(t: SignDictionary, code: string): string {
  return (t.errors as Record<string, string>)[code] ?? t.errors.generic;
}

/** A RUID is 68 characters of hex; nobody reads one, so show its head and tail. */
function shortLocalId(localId: string): string {
  const bare = localId.replace(/^[#<[{]|[#>\]}]$/g, '');
  return bare.length > 18 ? `${bare.slice(0, 8)}…${bare.slice(-6)}` : bare;
}

/* ─── Tab 1: what this account has ────────────────────────────────────────── */

function CollectionsTab({
  labels,
  setup,
  seals,
  collections,
  loading,
  onCreate,
}: {
  labels: Labels;
  setup: Setup;
  seals: Seal[];
  collections: Collection[];
  loading: boolean;
  onCreate: () => void;
}) {
  // The seal's own NFT data: its image and name, so the card is recognisable.
  const sealResource = seals[0]?.globalId.split(':')[0] ?? null;
  const { data: sealData } = useNftData(
    sealResource,
    seals.map((s) => s.localId),
  );

  return (
    <div className="space-y-6">
      {/* The seals. Normally one; the brand is open-mint and soulbound, so an
          account that minted a second is stuck with it and needs to know which
          one is actually doing the work. */}
      <ToolSection title={labels.seals.title} hint={labels.seals.hint}>
        {seals.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {labels.seals.none}
          </p>
        ) : (
          <div className="space-y-1.5">
            {seals.map((seal) => {
              const inUse = setup.seal?.globalId === seal.globalId;
              const data = sealData?.find((d) => d.id === seal.localId);
              return (
                <div
                  key={seal.globalId}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
                  style={{
                    borderColor: inUse
                      ? 'var(--color-primary)'
                      : 'var(--color-card-border)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <SafeImage
                      src={data?.imageUrl}
                      alt={data?.name || labels.seals.title}
                      fallbackName={data?.name || 'Radix Seal'}
                      className="size-11 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0">
                      <span
                        className="block truncate text-sm font-bold"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {data?.name || labels.seals.title}
                      </span>
                      <span
                        className="block truncate font-mono text-[11px]"
                        style={{ color: 'var(--color-text-muted)' }}
                        title={seal.localId}
                      >
                        {shortLocalId(seal.localId)}
                      </span>
                    </span>
                  </span>
                  {inUse && (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[11px] font-semibold"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      <BadgeCheck className="size-3.5" />
                      {labels.seals.inUse}
                    </span>
                  )}
                </div>
              );
            })}
            {seals.length > 1 && (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {labels.seals.severalNote}
              </p>
            )}
          </div>
        )}
      </ToolSection>

      <ToolSection title={labels.list.title} hint={labels.list.hint}>
        {/* Also while waiting for a just-created collection to be indexed, so
            the list on screen is visibly not the final answer yet. */}
        {loading && (
          <p
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span className="size-3.5 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
            {labels.list.loading}
          </p>
        )}
        {!loading && collections.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {labels.list.none}
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="flex items-center justify-center gap-2 px-6 h-11 rounded-full font-bold text-sm text-white bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] shadow transition-all hover:opacity-90 active:scale-95"
            >
              <Plus className="size-4" />
              {labels.list.createFirst}
            </button>
          </div>
        )}
        {collections.length > 0 && (
          <div className="space-y-1.5">
            {collections.map((collection) => {
              const isActive = collection.resourceAddress === setup.activeAddress;
              return (
                <button
                  key={collection.resourceAddress}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() =>
                    !isActive && setup.selectCollection(collection.resourceAddress)
                  }
                  title={collection.resourceAddress}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    isActive ? 'cursor-default' : 'cursor-pointer hover:border-[var(--color-primary)]'
                  }`}
                  style={{
                    borderColor: isActive
                      ? 'var(--color-primary)'
                      : 'var(--color-card-border)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <SafeImage
                      src={collection.iconUrl}
                      alt={collection.name || labels.list.untitled}
                      fallbackName={collection.name || collection.resourceAddress}
                      className="size-11 shrink-0 rounded-lg object-cover"
                    />
                    <span className="min-w-0">
                      <span
                        className="block truncate text-sm font-bold"
                        style={{ color: 'var(--color-text-main)' }}
                      >
                        {collection.name || labels.list.untitled}
                      </span>
                      <span
                        className="block truncate font-mono text-[11px]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {truncateAddress(collection.resourceAddress)}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      {labels.list.records.replace(
                        '{count}',
                        String(collection.totalSupply),
                      )}
                    </span>
                    <span
                      className="flex items-center gap-1 text-[11px] font-semibold"
                      style={{
                        color: isActive
                          ? 'var(--color-primary)'
                          : 'var(--color-text-muted)',
                      }}
                    >
                      {isActive && <Check className="size-3.5" />}
                      {isActive ? labels.list.active : labels.list.use}
                    </span>
                  </span>
                </button>
              );
            })}
            {collections.length > 1 && (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {labels.list.severalNote}
              </p>
            )}
          </div>
        )}
      </ToolSection>
    </div>
  );
}

/* ─── Tab 2: create another one ───────────────────────────────────────────── */

function CreateTab({
  labels,
  t,
  consoleT,
  account,
  seals,
  hasCollections,
  onCreated,
}: {
  labels: Labels;
  t: SignDictionary;
  consoleT: ConsoleToolProps['t'];
  account: string | null;
  seals: Seal[];
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
  /** Off by default: reuse the insignia the account already has. */
  const [newSeal, setNewSeal] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const busy = phase === 'minting-seal' || phase === 'creating-collection';
  const sealResource = seals[0]?.globalId.split(':')[0] ?? null;
  const { data: sealData } = useNftData(
    sealResource,
    seals.map((seal) => seal.localId),
  );

  const chosenSeal = seals.find((s) => s.globalId === sealGlobalId) ?? seals[0] ?? null;
  // One image for the whole creation: the collection's icon and, when the seal
  // has to be minted first, its insignia. Empty falls back to the Radix Seal
  // image inside the manifest builders, never to nothing.
  const imageUrl =
    logoUrl.trim() ||
    (typeof window !== 'undefined' ? sealImageUrl(window.location.origin) : '');

  /**
   * Dry-run whatever the create button would send FIRST: without a seal that is
   * the seal mint, with one it is the collection itself. Same rule the sign
   * onboarding follows, so the simulation always matches the next confirmation.
   */
  const onSimulate = () => {
    if (!account || activeNetworkId == null) return;
    const sealResource = radixSealAddress(activeNetworkId);
    if (!chosenSeal || newSeal) {
      if (sealResource) {
        preview.simulate(buildSealMintManifest({ account, sealResource }));
      }
      return;
    }
    preview.simulate(
      buildSignCollectionCreateManifest({
        account,
        sealGlobalId: chosenSeal.globalId,
        sealAddress: sealResource,
        networkId: activeNetworkId,
        collectionName: name.trim(),
        symbol: symbol.trim() || undefined,
        imageUrl,
        issuer: issuerMeta(),
      }),
    );
  };

  const issuerMeta = () =>
    orgName.trim() || orgUrl.trim() || logoUrl.trim()
      ? {
          orgName: orgName.trim(),
          orgWebsite: orgUrl.trim(),
          // Only ever the COLLECTION's icon. The insignia keeps the Radix Seal
          // image whatever is typed here.
          orgLogoUrl: logoUrl.trim() || undefined,
        }
      : undefined;

  const onSubmit = async () => {
    if (!account) return;
    const issuer = issuerMeta();
    // With a seal in hand the collection is one transaction; without one, the
    // seal is minted first and its id read back (same path the onboarding uses).
    const resource = chosenSeal && !newSeal
      ? await createCollection({
          account,
          sealGlobalId: chosenSeal.globalId,
          collectionName: name.trim(),
          symbol: symbol.trim() || undefined,
          imageUrl,
          issuer,
        })
      : await provisionCollection({
          account,
          existingSeal: null,
          forceNewSeal: newSeal,
          collectionName: name.trim(),
          symbol: symbol.trim() || undefined,
          imageUrl,
          issuer,
        });
    if (resource) {
      setCreated(resource);
      onCreated(resource);
    }
  };

  return (
    <div className="space-y-6">
      {/* Creating a second collection is legitimate (a separate issuer
          identity), but it splits the account's history in two, and whoever
          holds an invitation from the old one keeps seeing the old issuer. Say
          so before the button, not after. */}
      {hasCollections && (
        <div
          className="flex gap-3 rounded-2xl border px-4 py-3"
          style={{ borderColor: 'var(--color-warning, #eab308)', background: 'var(--color-surface)' }}
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            style={{ color: 'var(--color-warning, #eab308)' }}
          />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {labels.create.duplicateWarning}
          </p>
        </div>
      )}

      <ToolSection title={labels.create.title} hint={labels.create.hint}>
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
            {/* The buttons keep one-line descriptions, as everywhere else in
                the console; the consequence that cannot be undone is spelled
                out here instead of being cut off by an ellipsis. */}
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
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
                // Choosing a fresh insignia deselects every option here and
                // locks them, rather than hiding the block: the remembered
                // choice comes back the moment "reuse" is picked again.
                const isChosen = !newSeal && chosenSeal?.globalId === seal.globalId;
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
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
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

        {error && (
          <p className="text-xs font-medium text-[var(--color-danger)]">{errorText(t, error)}</p>
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

/* ─── Tab 3: the face buyers of your signatures see ───────────────────────── */

function IdentityTab({
  labels,
  t,
  consoleT,
  account,
  setup,
}: {
  labels: Labels;
  t: SignDictionary;
  consoleT: ConsoleToolProps['t'];
  account: string | null;
  setup: Setup;
}) {
  const collection = setup.collection;
  const { profile, refetch } = useCollectionProfile(collection?.resourceAddress ?? null);
  const { updateCollectionMetadata, phase, error } = useSealRequest();
  const preview = useTransactionPreview();
  const [edits, setEdits] = useState<Partial<Record<ProfileKey, string>>>({});
  const [saved, setSaved] = useState(false);

  const busy = phase === 'creating';
  // Uncommitted edits win; everything else shows what the ledger holds.
  const value = (key: ProfileKey) => edits[key] ?? profile?.[key] ?? '';
  const setValue = (key: ProfileKey, next: string) => {
    setSaved(false);
    setEdits((prev) => ({ ...prev, [key]: next }));
  };
  /** Only send what actually changed; the rest stays untouched on-ledger. */
  const changed = (key: ProfileKey) =>
    edits[key] !== undefined && edits[key] !== (profile?.[key] ?? '')
      ? edits[key]
      : undefined;

  if (!collection || !setup.seal) {
    return (
      <ToolSection title={labels.identity.title}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {labels.identity.noCollection}
        </p>
      </ToolSection>
    );
  }

  /** The fields actually changed, shared by the dry run and the real send. */
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

  return (
    <div className="space-y-6">
      <ToolSection title={labels.identity.title} hint={labels.identity.hint}>
        <div className="flex flex-wrap items-center gap-2">
          <Layers className="size-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {labels.identity.editing}
          </span>
          <span
            className="font-mono text-xs"
            style={{ color: 'var(--color-text-main)' }}
            title={collection.resourceAddress}
          >
            {truncateAddress(collection.resourceAddress)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            label={labels.create.nameLabel}
            value={value('name')}
            onChange={(v) => setValue('name', v)}
            disabled={busy}
          />
          <TextField
            label={labels.create.symbolLabel}
            value={value('symbol')}
            onChange={(v) => setValue('symbol', sanitizeSymbol(v))}
            maxLength={MAX_SYMBOL_LENGTH}
            disabled={busy}
          />
          <TextField
            label={labels.identity.orgNameLabel}
            hint={labels.identity.orgNameHint}
            value={value('orgName')}
            onChange={(v) => setValue('orgName', v)}
            disabled={busy}
          />
          <TextField
            label={labels.identity.orgUrlLabel}
            placeholder="https://…"
            value={value('orgUrl')}
            onChange={(v) => setValue('orgUrl', v)}
            disabled={busy}
          />
          <TextField
            label={labels.identity.logoLabel}
            hint={labels.identity.logoHint}
            placeholder="https://…"
            value={value('iconUrl')}
            onChange={(v) => setValue('iconUrl', v)}
            disabled={busy}
          />
        </div>

        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {labels.identity.lockedNote}
        </p>

        {error && (
          <p className="text-xs font-medium text-[var(--color-danger)]">{errorText(t, error)}</p>
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
            <Save className="size-4" />
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
    </div>
  );
}
