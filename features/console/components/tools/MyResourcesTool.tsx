'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Coins, Crown, Flame, Image as ImageIcon, Layers, Lock, Pencil, Snowflake, Undo2, Unlock } from 'lucide-react';
import type { ReactNode } from 'react';
import { ResourceCard } from '../shared/ResourceCard';
import { SafeImage } from '@/components/ui/SafeImage';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import { useLanguage } from '@/context/LanguageContext';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useResourceRoles } from '../../hooks/useResourceRoles';
import type { GatewayRoleEntry } from '@/features/dashboard/types';
import type { MetadataItem, MetadataTypedValue } from '@/features/dashboard/types/shared.types';
import { useConsoleTransaction } from '../../hooks/useConsoleTransaction';
import { useNftData, useMissingNfts, useNftFields } from '../../hooks/useNftData';
import { useTransactionPreview } from '../../hooks/useTransactionPreview';
import { buildBadgeProofManifest } from '../../lib/badge-proof-manifest';
import {
  setStringMetadata,
  setUrlMetadata,
  setAddressMetadata,
  setStringArrayMetadata,
  setAddressArrayMetadata,
} from '../../lib/metadata-manifests';
import {
  burnManifest,
  burnNonFungibleManifest,
  DEPOSIT_ALL_SUFFIX,
  freezeVaultManifest,
  lockMetadataManifest,
  mintFungibleManifest,
  formatNonFungibleLocalId,
  isValidNonFungibleLocalId,
  isEditableNftFieldKind,
  mintNonFungibleForIdType,
  nftFieldPlaceholder,
  nonFungibleIdKindLabel,
  updateNonFungibleDataManifest,
  suggestNonFungibleLocalId,
  toNonFungibleIdKind,
  NFT_ID_EXAMPLES,
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
import { extractRuleAddress } from '@/features/dashboard/utils/resourceUtils';
import { ManifestCode } from '../shared/ManifestCode';
import { OptionButtons } from '../shared/OptionButtons';
import { AuthRoleRow } from '../shared/AuthRoleRow';
import { TextField, SearchField, AddressField } from '../shared/fields';
import { SendToWalletButton } from '../shared/SendToWalletButton';
import { resolveTargetVault, targetKind } from '../../lib/vault-resolve';
import { SimulateButton, SimulateResultCard } from '../shared/SimulatePanel';
import { TxResultBanner } from '../shared/TxResultBanner';

type ResourceAction =
  | 'mint'
  | 'mintNft'
  | 'editNftData'
  | 'burn'
  | 'lockMetadata'
  | 'setOwnerRole'
  | 'recall'
  | 'freeze';

const ACTION_ICONS: Record<ResourceAction, ReactNode> = {
  mint: <Coins className="size-4" />,
  mintNft: <Layers className="size-4" />,
  editNftData: <ImageIcon className="size-4" />,
  burn: <Flame className="size-4" />,
  lockMetadata: <Pencil className="size-4" />,
  setOwnerRole: <Crown className="size-4" />,
  recall: <Undo2 className="size-4" />,
  freeze: <Snowflake className="size-4" />,
};

const FREEZE_FLAGS: FreezeFlag[] = ['withdraw', 'deposit', 'burn', 'all'];

const ACTION_TO_ROLES: Record<ResourceAction, { setter: string; updater: string } | null> = {
  mint: { setter: 'minter', updater: 'minter_updater' },
  mintNft: { setter: 'minter', updater: 'minter_updater' },
  editNftData: {
    setter: 'non_fungible_data_updater',
    updater: 'non_fungible_data_updater_updater',
  },
  burn: { setter: 'burner', updater: 'burner_updater' },
  lockMetadata: { setter: 'metadata_locker', updater: 'metadata_locker_updater' },
  setOwnerRole: null,
  recall: { setter: 'recaller', updater: 'recaller_updater' },
  freeze: { setter: 'freezer', updater: 'freezer_updater' },
};

const AUTH_ROLE_PAIRS = [
  { setter: 'minter', updater: 'minter_updater' },
  { setter: 'burner', updater: 'burner_updater' },
  { setter: 'freezer', updater: 'freezer_updater' },
  { setter: 'recaller', updater: 'recaller_updater' },
  { setter: 'withdrawer', updater: 'withdrawer_updater' },
  { setter: 'depositor', updater: 'depositor_updater', setterOptions: ['allowAll'] },
  { setter: 'metadata_setter', updater: 'metadata_setter_updater' },
  { setter: 'metadata_locker', updater: 'metadata_locker_updater' },
  { setter: 'non_fungible_data_updater', updater: 'non_fungible_data_updater_updater', nftOnly: true },
];

/**
 * Renders a metadata entry's typed value as text for display. Handles scalar
 * values (`value`), arrays (`values`, e.g. tags / dapp_definitions), and the
 * url/identifier shapes; returns '' when there is nothing displayable.
 */
function formatMetadataValue(typed?: MetadataTypedValue): string {
  if (!typed) return '';
  if (Array.isArray(typed.values)) {
    return typed.values
      .map((v) =>
        typeof v === 'object' && v !== null
          ? ((v as { value?: string }).value ?? JSON.stringify(v))
          : String(v),
      )
      .join(', ');
  }
  if (typed.value != null) {
    return typeof typed.value === 'object' ? JSON.stringify(typed.value) : String(typed.value);
  }
  if (typed.url != null) return String(typed.url);
  if (typed.identifier != null) return String(typed.identifier);
  return '';
}

/** Metadata types whose value can be edited from a single text field. */
function isEditableMetadataType(type?: string): boolean {
  return [
    'String',
    'Url',
    'GlobalAddress',
    'Address',
    'StringArray',
    'GlobalAddressArray',
    'AddressArray',
  ].includes(type ?? 'String');
}

/** SET_METADATA for an edited value, preserving its on-ledger type. */
function buildSetMetadata(
  address: string,
  key: string,
  typed: MetadataTypedValue | undefined,
  value: string,
): string {
  const asList = () =>
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  switch (typed?.type) {
    case 'Url':
      return setUrlMetadata(address, key, value);
    case 'GlobalAddress':
    case 'Address':
      return setAddressMetadata(address, key, value);
    case 'StringArray':
      return setStringArrayMetadata(address, key, asList());
    case 'GlobalAddressArray':
    case 'AddressArray':
      return setAddressArrayMetadata(address, key, asList());
    default:
      return setStringMetadata(address, key, value);
  }
}

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
        backgroundColor: 'transparent',
      }}
    >
      {locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
      {label}
    </button>
  );
}

export default function MyResourcesTool({ t }: ConsoleToolProps) {
  const common = t.common;
  const labels = t.myResources;
  const { language } = useLanguage();
  const { isLoading: walletLoading, activeNetwork } = useRadixWallet();

  const [accounts, setAccounts] = useState<string[]>([]);
  const [resource, setResource] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [action, setAction] = useState<ResourceAction>('mint');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [burnNftIds, setBurnNftIds] = useState<Set<string>>(new Set());
  /** NFT whose data is being rewritten (editNftData). */
  const [editNftId, setEditNftId] = useState<string | null>(null);
  // Recall targets whole vaults (you cannot recall an individual NFT without
  // its vault), each identified by the account that owns it.
  const [recallVaults, setRecallVaults] = useState<Set<string>>(new Set());
  const [proof, setProof] = useState<BadgeProofSelection | null>(null);
  const [showManifest, setShowManifest] = useState(false);
  const [showAuthRoles, setShowAuthRoles] = useState(false);
  const [lockedMetaKeys, setLockedMetaKeys] = useState<Set<string>>(new Set());
  const [burnNftSearch, setBurnNftSearch] = useState('');
  const [recallNftSearch, setRecallNftSearch] = useState('');
  const [freezeVaultSearch, setFreezeVaultSearch] = useState('');
  const [freezeVaults, setFreezeVaults] = useState<Set<string>>(new Set());
  const [badgeSearch, setBadgeSearch] = useState('');

  // For backwards compatibility in queries
  const account = accounts[0] || null;

  const { data: holdings, isLoading: holdingsLoading } = useAccountResources(accounts);
  const { data: rolesData, isLoading: rolesLoading } = useResourceRoles(resource);

  let normalizedRoles: Record<string, string> | undefined = undefined;
  if (rolesData?.roleAssignments) {
    normalizedRoles = {};
    const r = rolesData.roleAssignments;
    if (r.owner) {
      normalizedRoles['owner'] = r.owner.rule?.type === 'DenyAll' ? 'denyAll' : (r.owner.rule?.type === 'AllowAll' ? 'allowAll' : 'badge');
    }
    if (Array.isArray(r.entries)) {
      for (const entry of r.entries) {
        if (entry.role_key && entry.role_key.name) {
          if (entry.assignment?.resolution === 'Owner') {
            normalizedRoles[entry.role_key.name] = 'owner';
          } else {
            const t = entry.assignment?.explicit_rule?.type;
            normalizedRoles[entry.role_key.name] = t === 'DenyAll' ? 'denyAll' : (t === 'AllowAll' ? 'allowAll' : 'badge');
          }
        }
      }
    }
  }
  const { sendTransaction, isSending, result, error, reset } = useConsoleTransaction();
  const preview = useTransactionPreview();

  const field = (key: string) => (fields[key] ?? '').trim();
  const setField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const isFungible = !!holdings?.fungibles.some((f) => f.resourceAddress === resource);
  const isNonFungible = !!holdings?.nonFungibles.some((nf) => nf.resourceAddress === resource);

  // Selected resource data for pre-filling disabled inputs
  const selectedFungible = holdings?.fungibles.find((f) => f.resourceAddress === resource);
  const selectedNonFungible = holdings?.nonFungibles.find((nf) => nf.resourceAddress === resource);

  const { data: ownedNftData } = useNftData(isNonFungible ? resource : null, selectedNonFungible?.ids || []);
  // Only loaded once an NFT is picked, which only happens in editNftData.
  const { data: nftFieldsData } = useNftFields(isNonFungible ? resource : null, editNftId);
  /**
   * The resource's NF-data schema, learned from an NFT it already holds: the
   * Gateway reports the fields in schema order. Minting has to supply EVERY
   * field, so a resource with custom ones (a Radix Seal collection carries
   * nine beyond the three standard) rejects a three-field mint outright.
   */
  const { data: schemaSample } = useNftFields(
    isNonFungible ? resource : null,
    selectedNonFungible?.ids[0] ?? null,
  );
  const customFields = (schemaSample ?? []).slice(3);
  const customFieldNames = customFields.map((f) => f.name);
  const customFieldKey = (name: string) => `nftcustom:${resource}:${name}`;
  const nftFields = nftFieldsData ?? [];
  /**
   * Fields the schema declared mutable, straight from the ledger. Unlike
   * metadata, this set is fixed when the resource is created: an NFT field
   * cannot be locked or unlocked afterwards, so there is no lock toggle here.
   */
  const mutableNftFields =
    rolesData?.details?.details?.non_fungible_data_mutable_fields ?? [];
  const nftFieldKey = (name: string) => `nftdata:${resource}:${editNftId}:${name}`;
  const { data: missingNftData } = useMissingNfts(isNonFungible ? resource : null, selectedNonFungible?.ids || []);

  /* ── NFT local-id type ──
     Fixed when the collection was created and NOT negotiable: minting an
     integer id into a RUID collection (the Radix Seal brand is one) is
     rejected by the engine as InvalidNonFungibleIdType. Everything about the
     mint form follows from this value. */
  const nftIdKind = toNonFungibleIdKind(rolesData?.details?.details?.non_fungible_id_type);
  const nftIdLabel = nonFungibleIdKindLabel(nftIdKind);
  const ruidCollection = nftIdKind === 'Ruid';
  const suggestedNftId = suggestNonFungibleLocalId(nftIdKind, selectedNonFungible?.ids ?? []);
  const rawNftId = fields.nftId ?? suggestedNftId;
  // RUID ids come from the ledger, so nothing is sent for them.
  const mintNftId = ruidCollection ? '' : formatNonFungibleLocalId(nftIdKind, rawNftId);
  const nftIdInvalid =
    !ruidCollection &&
    rawNftId.trim() !== '' &&
    !isValidNonFungibleLocalId(nftIdKind, mintNftId);

  interface VaultInfo {
    address: string;
    /** Account that owns the vault (shown so the user targets the right one). */
    account?: string;
    nftCount: number;
    /** Every NFT local id held in this vault (recall targets them all). */
    ids: string[];
    firstImageUrl?: string;
  }

  const allVaultsData: VaultInfo[] = (() => {
    if (!isNonFungible) return [];
    const map = new Map<string, VaultInfo>();

    // The connected account's own vault.
    const ownedVault = selectedNonFungible?.vaultAddress;
    if (ownedVault) {
      const ownedIds = selectedNonFungible?.ids ?? [];
      map.set(ownedVault, {
        address: ownedVault,
        account: account ?? undefined,
        nftCount: ownedNftData?.length ?? ownedIds.length,
        ids: [...ownedIds],
        firstImageUrl: ownedNftData?.[0]?.imageUrl || selectedNonFungible?.iconUrl,
      });
    }

    // Vaults in other accounts, resolved from the NFT location endpoint.
    if (missingNftData) {
      for (const nft of missingNftData) {
        if (!nft.vaultAddress) continue;
        let vault = map.get(nft.vaultAddress);
        if (!vault) {
          vault = {
            address: nft.vaultAddress,
            account: nft.ownerAccount,
            nftCount: 0,
            ids: [],
            firstImageUrl: nft.imageUrl || selectedNonFungible?.iconUrl,
          };
          map.set(nft.vaultAddress, vault);
        }
        vault.nftCount++;
        vault.ids.push(nft.id);
        if (!vault.account && nft.ownerAccount) vault.account = nft.ownerAccount;
      }
    }

    return Array.from(map.values());
  })();

  /** Card label for a vault: the owning account, else a short vault id. */
  const vaultLabel = (v: VaultInfo) =>
    v.account ? truncateAddress(v.account, 6, 6) : `Bóveda …${v.address.slice(-4)}`;

  /** Selectable vault card (shared by recall and freeze). Shows the owning
   *  account address and the NFT count. */
  const renderVaultCard = (
    vault: VaultInfo,
    isSelected: boolean,
    onToggle: () => void,
    disabled: boolean,
  ) => (
    <button
      key={vault.address}
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="group flex items-center gap-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-sm active:scale-95 p-2.5"
      style={{
        background: isSelected ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-surface)',
        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-card-border)',
      }}
      title={`${vault.account ?? vault.address}`}
    >
      {vault.firstImageUrl && (
        <SafeImage
          src={vault.firstImageUrl}
          alt={vault.address}
          fallbackName={vault.account || 'Vault'}
          className="size-8 rounded-lg object-cover shadow-sm shrink-0"
        />
      )}
      <div className="flex flex-col min-w-0">
        <span
          className="truncate font-mono font-bold text-xs leading-tight"
          style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}
        >
          {vaultLabel(vault)}
        </span>
        <span
          className="truncate text-[11px] font-medium opacity-70"
          style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
        >
          {vault.nftCount} NFT{vault.nftCount !== 1 ? 's' : ''}
        </span>
      </div>
      {isSelected && <Check className="size-4 shrink-0 ml-auto" style={{ color: 'var(--color-primary)' }} />}
    </button>
  );

  const resourceOptions = [
    ...(holdings?.fungibles ?? []).map((f) => ({
      value: f.resourceAddress,
      name: f.name || f.symbol || labels.fields.unnamedResource,
      address: `${formatNumber(Number(f.amount), 4, language)} · ${truncateAddress(f.resourceAddress, 6, 5)}`,
      iconUrl: f.iconUrl,
    })),
    ...(holdings?.nonFungibles ?? []).map((nf) => ({
      value: nf.resourceAddress,
      name: nf.name || labels.fields.unnamedResource,
      address: `${nf.ids.length} NFT · ${truncateAddress(nf.resourceAddress, 6, 5)}`,
      iconUrl: nf.iconUrl,
    })),
  ];

  const filteredResourceOptions = resourceOptions.filter((opt) =>
    opt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const actionLabels = labels.actions as Record<string, { name: string; hint: string }>;
  const availableActions: ResourceAction[] = (
    ['mint', 'mintNft', 'editNftData', 'burn', 'lockMetadata', 'setOwnerRole', 'recall', 'freeze'] as ResourceAction[]
  ).filter((candidate) => {
    if (candidate === 'mint') return isFungible;
    if (candidate === 'mintNft') return isNonFungible;
    if (candidate === 'editNftData') return isNonFungible;
    if (candidate === 'burn') return isFungible || isNonFungible;
    return true;
  });
  const activeAction = availableActions.includes(action) ? action : availableActions[0] ?? 'lockMetadata';

  // Recall/freeze target: a single field accepting an account_ (resolved to its
  // vault for this resource, with NFT ids) or a raw internal_vault_ address.
  const targetInput = (fields.vault ?? '').trim();
  const targetIsResolvable =
    (activeAction === 'recall' || activeAction === 'freeze') &&
    !!resource &&
    targetKind(targetInput) !== 'unknown';
  const {
    data: resolvedTarget,
    isFetching: resolvingTarget,
    error: resolveError,
  } = useQuery({
    queryKey: ['resolve-vault', activeNetwork, resource, targetInput],
    enabled: targetIsResolvable,
    queryFn: () => resolveTargetVault(targetInput, resource ?? '', activeNetwork),
    staleTime: 30_000,
  });
  // NFT ids for a manually targeted vault: from the resolver (account input) or,
  // for a raw vault, from the already-discovered vault list.
  const resolvedNftIds = (): string[] => {
    if (!resolvedTarget) return [];
    if (resolvedTarget.ids.length > 0) return resolvedTarget.ids;
    return allVaultsData.find((v) => v.address === resolvedTarget.vault)?.ids ?? [];
  };

  // Only the first 50 discovered vaults are shown as selectable cards; the rest
  // are reached through the account/vault field above.
  const VAULT_CARD_LIMIT = 50;
  const filterVaultsBySearch = (search: string) =>
    allVaultsData.filter(
      (v) =>
        !search ||
        v.address.toLowerCase().includes(search.toLowerCase()) ||
        (v.account?.toLowerCase().includes(search.toLowerCase()) ?? false),
    );

  /* ── Build the manifest for the configured action ── */
  const buildActionManifest = (): string => {
    if (!account || !resource) return '';
    switch (activeAction) {
      case 'mint':
        return field('amount')
          ? mintFungibleManifest(resource, field('amount')) + DEPOSIT_ALL_SUFFIX(account)
          : '';
      case 'mintNft': {
        // The image defaults to the collection icon and the id to the next free
        // one (both shown as placeholders), so entering the NAME alone is enough
        // to build the manifest. The id must match the type the collection was
        // created with, and RUID collections take no id at all.
        const nftName = field('nftName');
        if (!nftName) return '';
        // An id of the wrong shape would only fail at the engine, so no
        // manifest is offered until it matches the collection's type.
        if (!ruidCollection && (!mintNftId || nftIdInvalid)) return '';
        return (
          mintNonFungibleForIdType(resource, nftIdKind, {
            id: mintNftId,
            name: nftName,
            description: field('nftDescription'),
            keyImageUrl: field('nftImageUrl') || selectedNonFungible?.iconUrl || '',
            // Positional: the schema's own order, every field present.
            customValues: customFields.map((f) => ({
              value: field(customFieldKey(f.name)),
              kind: f.kind,
            })),
          }) + DEPOSIT_ALL_SUFFIX(account)
        );
      }
      case 'editNftData': {
        if (!editNftId) return '';
        // Same shape as editing metadata: every field the user actually
        // changed, in one transaction. Immutable fields never reach here.
        return nftFields
          .filter((f) => mutableNftFields.includes(f.name))
          .map((f) => {
            const edited = fields[nftFieldKey(f.name)];
            return edited !== undefined && edited !== f.value
              ? updateNonFungibleDataManifest(
                  resource,
                  editNftId,
                  f.name,
                  edited,
                  f.kind,
                )
              : '';
          })
          .join('');
      }
      case 'burn':
        if (isNonFungible) {
          return burnNftIds.size > 0 ? burnNonFungibleManifest(account, resource, Array.from(burnNftIds)) : '';
        }
        return field('amount') ? burnManifest(account, resource, field('amount')) : '';
      case 'lockMetadata': {
        const items = (rolesData?.details?.metadata?.items as MetadataItem[] | undefined) ?? [];
        let m = '';
        // 1) Apply edits to unlocked, editable keys (SET must precede LOCK).
        for (const item of items) {
          if (item.is_locked || !isEditableMetadataType(item.value?.typed?.type)) continue;
          const edited = fields[`meta:${resource}:${item.key}`];
          const original = formatMetadataValue(item.value?.typed);
          if (edited !== undefined && edited.trim() !== original) {
            m += buildSetMetadata(resource, item.key, item.value?.typed, edited.trim());
          }
        }
        // 2) Lock the keys the user marked.
        for (const k of lockedMetaKeys) m += lockMetadataManifest(resource, k);
        return m;
      }
      case 'setOwnerRole': {
        const currentOwnerRule = normalizedRoles?.['owner'] || 'badge';
        const kind = (field('ruleKind') || currentOwnerRule) as SimpleAccessRule['kind'] | '';
        if (!kind) return '';
        if (kind === 'badge' && !field('badgeResource')) return '';
        const rule: SimpleAccessRule =
          kind === 'badge' ? { kind, resourceAddress: field('badgeResource') } : { kind };
        return setOwnerRoleManifest(resource, rule);
      }
      case 'recall': {
        if (isNonFungible) {
          // Recall every NFT in each selected vault (recall is vault-scoped):
          // the cards the user picked, plus a manually targeted vault beyond the
          // listed ones (an account_ input resolves its vault AND its ids).
          let manifest = '';
          for (const vaultAddr of recallVaults) {
            const vault = allVaultsData.find((v) => v.address === vaultAddr);
            if (vault && vault.ids.length > 0) {
              manifest += recallManifest(vault.address, '0', vault.ids);
            }
          }
          if (resolvedTarget && !recallVaults.has(resolvedTarget.vault)) {
            const ids = resolvedNftIds();
            if (ids.length > 0) manifest += recallManifest(resolvedTarget.vault, '0', ids);
          }
          if (manifest) manifest += DEPOSIT_ALL_SUFFIX(account);
          return manifest;
        }
        // Fungible: recall an amount from the resolved target vault (recall
        // targets OTHER accounts' vaults, entered as an account or vault). Only
        // fall back to the own vault when the field is empty: a typed-but-
        // unresolved target must NOT silently hit the connected account.
        const recallVault =
          resolvedTarget?.vault || (targetInput === '' ? selectedFungible?.vaultAddress ?? '' : '');
        const recallAmount = field('amount');
        return recallVault && recallAmount
          ? recallManifest(recallVault, recallAmount) + DEPOSIT_ALL_SUFFIX(account)
          : '';
      }
      case 'freeze': {
        const freezeFlag = field('flag');
        const freezeMode = field('mode') || 'freeze';
        if (!freezeFlag) return '';

        if (isNonFungible) {
          // Selected cards plus a manually targeted vault (freeze needs no ids).
          const targets = new Set<string>(freezeVaults);
          if (resolvedTarget) targets.add(resolvedTarget.vault);
          if (targets.size === 0) return '';
          return Array.from(targets)
            .map((vault) => freezeVaultManifest(vault, freezeFlag as FreezeFlag, freezeMode !== 'unfreeze'))
            .join('');
        }

        // Fungible: freeze/unfreeze the resolved target vault. Only fall back to
        // the own vault when the field is empty (a typed-but-unresolved target
        // must not silently hit the connected account).
        const freezeVault =
          resolvedTarget?.vault || (targetInput === '' ? selectedFungible?.vaultAddress ?? '' : '');
        return freezeVault
          ? freezeVaultManifest(freezeVault, freezeFlag as FreezeFlag, freezeMode !== 'unfreeze')
          : '';
      }
    }
  };

  const actionManifest = buildActionManifest();
  const manifest = actionManifest
    ? (proof ? buildBadgeProofManifest([proof]) : '') + actionManifest
    : '';
  const baseCanSend = !!manifest && !isSending && !walletLoading;


  const roleInfo = ACTION_TO_ROLES[activeAction];
  let requiredBadgeForAction: string[] | undefined = undefined;

  // Extract the owner badge address (used as fallback)
  const ownerBadgeAddr = rolesData?.roleAssignments?.owner?.rule
    ? extractRuleAddress(rolesData.roleAssignments.owner.rule)
    : null;

  if (roleInfo && rolesData?.roleAssignments) {
    const r = rolesData.roleAssignments;
    if (Array.isArray(r.entries)) {
      const entry = r.entries.find((e: GatewayRoleEntry) => e.role_key?.name === roleInfo.setter);
      if (entry?.assignment) {
        if (entry.assignment.resolution === 'Owner') {
          // Role inherits from Owner → use the owner badge
          if (ownerBadgeAddr) requiredBadgeForAction = [ownerBadgeAddr];
        } else if (entry.assignment.explicit_rule?.type === 'Protected') {
          // Role has its own explicit Protected rule with a badge
          const addr = extractRuleAddress(entry.assignment.explicit_rule);
          if (addr) requiredBadgeForAction = [addr];
        }
        // DenyAll / AllowAll → no badge needed for this specific action,
        // but fall back to owner badge so the user can still present it
        // for other operations (e.g. setOwnerRole)
        if (!requiredBadgeForAction && ownerBadgeAddr) {
          requiredBadgeForAction = [ownerBadgeAddr];
        }
      } else {
        // No assignment at all → fall back to owner badge
        if (ownerBadgeAddr) requiredBadgeForAction = [ownerBadgeAddr];
      }
    } else {
      if (ownerBadgeAddr) requiredBadgeForAction = [ownerBadgeAddr];
    }
  } else if (activeAction === 'setOwnerRole') {
    if (ownerBadgeAddr) requiredBadgeForAction = [ownerBadgeAddr];
  }

  let prioritizedIdsForProof: string[] = [];
  if (activeAction === 'burn') prioritizedIdsForProof = Array.from(burnNftIds);
  if (activeAction === 'editNftData' && editNftId) prioritizedIdsForProof = [editNftId];
  else if (activeAction === 'recall') {
    prioritizedIdsForProof = Array.from(recallVaults).flatMap(
      (v) => allVaultsData.find((x) => x.address === v)?.ids ?? [],
    );
  }

  // Effective rule governing the active action (roles set to 'owner' inherit
  // the resource owner rule).
  const resolveEffectiveRule = (roleName?: string): string | undefined => {
    if (!roleName) return undefined;
    const r = normalizedRoles?.[roleName];
    return r === 'owner' ? normalizedRoles?.['owner'] : r;
  };
  const activeRule =
    activeAction === 'setOwnerRole'
      ? normalizedRoles?.['owner']
      : resolveEffectiveRule(roleInfo?.setter);
  // A Radix Seal signing collection is created with a LOCKED (Fixed) owner role,
  // so SET_OWNER_ROLE can never succeed on it. Detected by its metadata marker;
  // the gateway does not expose the owner-role lock reliably for other resources.
  const ownerRoleLocked = (
    (rolesData?.details?.metadata?.items as MetadataItem[] | undefined) ?? []
  ).some((m) => m.key === 'radix_sign_collection' && m.value?.typed?.value === 'v1');
  const ownerRoleActionLocked = activeAction === 'setOwnerRole' && ownerRoleLocked;

  // A 'badge' rule needs a matching badge PROOF presented. DenyAll can never
  // succeed. AllowAll needs nothing. A locked owner role can never be changed.
  const actionNeedsBadge = activeRule === 'badge';
  const actionForbidden = activeRule === 'denyAll' || ownerRoleActionLocked;
  // The picker only offers required badges the account actually holds, so when
  // the user lacks it, `proof` stays null → the action must stay disabled.
  const presentedBadgeOk =
    !!proof &&
    (!requiredBadgeForAction ||
      requiredBadgeForAction.some(
        (b) => b === proof.resourceAddress || b.startsWith(proof.resourceAddress),
      ));
  const badgeRequirementMet = !actionNeedsBadge || presentedBadgeOk;
  const canSend = baseCanSend && !actionForbidden && badgeRequirementMet;

  return (
    <div className="space-y-5">
      <ToolSection title={labels.accountTitle}>
        <AccountPicker multiple value={accounts} onChange={setAccounts} disabled={isSending} />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {labels.resourceTitle}
              </span>
              <span className="text-[11px] opacity-70 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {labels.resourceHint}
              </span>
            </div>
            {holdingsLoading ? (
              <p className="text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>{labels.loading}</p>
            ) : (
              <SearchField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={labels.fields.searchResource}
                disabled={isSending}
              />
            )}
          </div>

          {!holdingsLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {filteredResourceOptions.map((opt) => {
                const isActive = opt.value === resource;
                return (
                  <ResourceCard
                    key={opt.value}
                    isActive={isActive}
                    disabled={isSending}
                    onClick={() => setResource(isActive ? '' : opt.value)}
                    name={opt.name}
                    address={opt.address}
                    fullAddress={opt.value}
                    iconUrl={opt.iconUrl}
                  />
                );
              })}
              {resourceOptions.length > 0 && filteredResourceOptions.length === 0 && (
                <div className="col-span-1 sm:col-span-3 text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {labels.fields.noResults}
                </div>
              )}
            </div>
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
          requiredBadges={requiredBadgeForAction}
          prioritizedIds={prioritizedIdsForProof}
          rolesLoading={rolesLoading}
        />
      </ToolSection>

      {resource && normalizedRoles && (
        <ToolSection title={t.createToken.authRoles} hint={t.createToken.authRolesHint}>
          <button
            type="button"
            onClick={() => setShowAuthRoles((prev) => !prev)}
            aria-expanded={showAuthRoles}
            className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            <ChevronDown className={`size-3.5 transition-transform ${showAuthRoles ? 'rotate-180' : ''}`} />
            {t.createToken.authRoles}
          </button>
          {showAuthRoles && (
            <div className="divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
              {AUTH_ROLE_PAIRS.flatMap(({ setter, updater, nftOnly, setterOptions }) => {
                if (nftOnly && !isNonFungible) return [];
                const setterVal = normalizedRoles[setter] || 'owner';
                const updaterVal = normalizedRoles[updater] || 'owner';
                const authRoleLabels: Record<string, string> = {
                  owner: t.createToken.owner,
                  allowAll: t.createToken.allowAll,
                  denyAll: t.createToken.denyAll,
                  badge: common.ownerRole_badge,
                };
                return [
                  <AuthRoleRow
                    key={setter}
                    roleKey={setter}
                    roleHint={(t.createToken.roleHints as Record<string, string>)[setter]}
                    value={setterVal as string}
                    options={setterOptions ?? ['owner', 'denyAll', 'allowAll']}
                    labels={authRoleLabels}
                    optionHints={t.createToken.optionHints}
                    readOnly
                  />,
                  <AuthRoleRow
                    key={updater}
                    roleKey={updater}
                    roleHint={(t.createToken.roleHints as Record<string, string>)[updater]}
                    value={updaterVal as string}
                    options={['owner', 'denyAll', 'allowAll']}
                    labels={authRoleLabels}
                    optionHints={t.createToken.optionHints}
                    readOnly
                  />
                ];
              })}
            </div>
          )}
        </ToolSection>
      )}

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
          {(() => {
            // roleInfo is already defined at the component root
            let roleStr = '';
            let isActionLocked = false;
            let ruleType = 'allowAll';
            if (roleInfo && normalizedRoles) {
              const setterVal = normalizedRoles[roleInfo.setter] || 'owner';
              const updaterVal = normalizedRoles[roleInfo.updater] || 'owner';
              const authRoleLabels: Record<string, string> = {
                owner: t.createToken.owner,
                allowAll: t.createToken.allowAll,
                denyAll: t.createToken.denyAll,
                badge: common.ownerRole_badge,
              };
              roleStr = authRoleLabels[setterVal] || setterVal;
              isActionLocked = updaterVal === 'denyAll';
              ruleType = setterVal;
            } else if (activeAction === 'setOwnerRole' && normalizedRoles) {
              const authRoleLabels: Record<string, string> = {
                owner: t.createToken.owner,
                allowAll: t.createToken.allowAll,
                denyAll: t.createToken.denyAll,
                badge: common.ownerRole_badge,
              };
              const ownerVal = normalizedRoles['owner'] || 'badge';
              roleStr = authRoleLabels[ownerVal] || ownerVal;
              ruleType = ownerVal;
              // The owner role of a signing collection is Fixed: mark it locked.
              isActionLocked = ownerRoleLocked;
            }

            // A locked owner role (Fixed) can never be changed, so its options
            // and the send button are disabled, like a denied action.
            const isActionDenied = ruleType === 'denyAll' || ownerRoleActionLocked;
            // When the action needs a badge the account does not hold (so no
            // proof is presented), every input is locked too, making it clear
            // nothing can be edited until the badge is presented.
            const badgeMissing = actionNeedsBadge && !presentedBadgeOk;
            const inputsDisabled = isActionDenied || badgeMissing;

            return (
              <>
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
                  layout="grid"
                  hideCheck={true}
                  buttonClassName="!flex-col py-3 gap-1.5 min-h-[64px]"
                  className="grid-flow-col auto-cols-fr overflow-x-auto pb-1"
                />

                {roleStr && (
                  <div className={`mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs font-medium border ${isActionDenied || badgeMissing ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-[var(--color-primary)]/5 text-[var(--color-primary)] border-[var(--color-primary)]/20'}`}>
                    <div className="flex items-center gap-2">
                      <span className="opacity-80">{labels.fields.requirementFor} {actionLabels[activeAction]?.name || activeAction}:</span>
                      <span className="font-bold flex items-center gap-1.5">
                        {ruleType === 'allowAll' && <Check className="size-3.5" />}
                        {ruleType === 'denyAll' && <Lock className="size-3.5" />}
                        {ruleType === 'badge' && <Crown className="size-3.5" />}
                        {roleStr}
                      </span>
                    </div>
                    {isActionLocked && !badgeMissing && (
                      <div className="flex items-center gap-1.5 opacity-80" title={labels.fields.ruleLockedHint}>
                        <Lock className="size-3" />
                        <span>{labels.fields.ruleLocked}</span>
                      </div>
                    )}
                    {/* Badge-missing warning lives here (stable banner) so it
                        never shifts the form below. */}
                    {badgeMissing && (
                      <div className="flex items-center gap-1.5 basis-full">
                        <Lock className="size-3 shrink-0" />
                        <span>{labels.fields.badgeRequiredHint}</span>
                      </div>
                    )}
                  </div>
                )}

                {(activeAction === 'mint' || (activeAction === 'burn' && isFungible)) && (
                  <TextField
                    label={labels.fields.amount}
                    value={isActionDenied ? (selectedFungible?.amount ?? '') : (fields.amount ?? '')}
                    onChange={(value) => setField('amount', value)}
                    type="number"
                    disabled={isSending || inputsDisabled}
                    placeholder={rolesData?.details?.details?.total_supply ? `Suministro: ${formatNumber(Number(rolesData.details.details.total_supply), 4, language)}` : ''}
                  />
                )}

                {activeAction === 'burn' && isNonFungible && selectedNonFungible && (
                  <div className="flex flex-col gap-3">
                    <SearchField
                      value={burnNftSearch}
                      onChange={setBurnNftSearch}
                      placeholder={labels.fields.searchNfts.replace('{count}', selectedNonFungible.ids.length.toString())}
                      disabled={isSending || inputsDisabled}
                    />
                    <div className="flex items-center gap-2 text-xs font-medium px-1" style={{ color: 'var(--color-primary)', visibility: burnNftIds.size > 0 ? 'visible' : 'hidden' }}>
                      <Flame className="size-3.5" />
                      <span>{burnNftIds.size === 1 ? labels.fields.nftsSelected.replace('{count}', '1') : labels.fields.nftsSelectedPlural.replace('{count}', burnNftIds.size.toString())}</span>
                      <button
                        type="button"
                        onClick={() => setBurnNftIds(new Set())}
                        className="ml-auto text-[11px] underline cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {labels.fields.clearSelection}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {(ownedNftData || selectedNonFungible.ids.map(id => ({ id, name: selectedNonFungible.name || labels.fields.unnamedNft, imageUrl: selectedNonFungible.iconUrl })))
                        .filter(nft => !burnNftSearch || nft.id.toLowerCase().includes(burnNftSearch.toLowerCase()) || nft.name?.toLowerCase().includes(burnNftSearch.toLowerCase()))
                        .map((nft) => {
                          const isSelected = burnNftIds.has(nft.id);
                          return (
                            <button
                              key={nft.id}
                              type="button"
                              disabled={isSending || inputsDisabled}
                              onClick={() => {
                                setBurnNftIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(nft.id)) next.delete(nft.id);
                                  else next.add(nft.id);
                                  return next;
                                });
                              }}
                              className="group flex items-center gap-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-sm active:scale-95 p-2.5"
                              style={{
                                background: isSelected ? 'rgba(var(--color-primary-rgb), 0.08)' : 'var(--color-surface)',
                                borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-card-border)',
                              }}
                              title={nft.id}
                            >
                              {(nft.imageUrl || selectedNonFungible.iconUrl) && (
                                <SafeImage
                                  src={nft.imageUrl || selectedNonFungible.iconUrl || ''}
                                  alt={nft.id}
                                  fallbackName={nft.name || selectedNonFungible.name || labels.fields.unnamedNft}
                                  className="size-8 rounded-lg object-cover shadow-sm shrink-0"
                                />
                              )}
                              <div className="flex flex-col min-w-0">
                                <span
                                  className="truncate font-bold text-xs leading-tight"
                                  style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}
                                >
                                  {nft.name || selectedNonFungible.name || labels.fields.unnamedNft}
                                </span>
                                <span
                                  className="truncate text-[11px] font-medium opacity-70"
                                  style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                                >
                                  {nft.id}
                                </span>
                              </div>
                              {isSelected && (
                                <Check className="size-4 shrink-0 ml-auto" style={{ color: 'var(--color-primary)' }} />
                              )}
                            </button>
                          );
                        })}
                      {(!ownedNftData ? selectedNonFungible.ids : ownedNftData).filter(nft => !burnNftSearch || (typeof nft === 'string' ? nft : nft.id).toLowerCase().includes(burnNftSearch.toLowerCase())).length === 0 && (
                        <div className="col-span-full text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {labels.fields.noNftsFound}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeAction === 'mintNft' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Each input is the NEW NFT's own data field. The rest start
                        empty (the collection icon only pre-fills the image, as a
                        convenience) so nothing carries the resource address.
                        The id field only exists for collections whose ids the
                        minter chooses: a RUID collection gets its ids from the
                        ledger, so there is nothing to fill in. */}
                    {ruidCollection ? (
                      <div className="sm:col-span-2">
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {labels.fields.nftIdRuid}
                        </p>
                      </div>
                    ) : (
                      <TextField
                        label={labels.fields.nftId}
                        hint={
                          nftIdInvalid
                            ? labels.fields.nftIdInvalid.replace('{type}', nftIdLabel)
                            : labels.fields.nftIdHint.replace('{type}', nftIdLabel)
                        }
                        // States the type and shows one, so a collection that
                        // does not take plain integers says so before the
                        // engine does.
                        placeholder={labels.fields.nftIdPlaceholder
                          .replace('{type}', nftIdLabel)
                          .replace('{example}', NFT_ID_EXAMPLES[nftIdKind])}
                        value={rawNftId}
                        onChange={(value) => setField('nftId', value)}
                        disabled={isSending || inputsDisabled}
                      />
                    )}
                    <TextField
                      label={labels.fields.nftName}
                      placeholder={
                        schemaSample?.[0]?.value || labels.fields.nftNamePlaceholder
                      }
                      value={fields.nftName ?? ''}
                      onChange={(value) => setField('nftName', value)}
                      disabled={isSending || inputsDisabled}
                    />
                    <TextField
                      label={labels.fields.nftDescription}
                      placeholder={
                        schemaSample?.[1]?.value ||
                        labels.fields.nftDescriptionPlaceholder
                      }
                      value={fields.nftDescription ?? ''}
                      onChange={(value) => setField('nftDescription', value)}
                      disabled={isSending || inputsDisabled}
                    />
                    <TextField
                      label={labels.fields.nftImageUrl}
                      placeholder="https://…"
                      value={fields.nftImageUrl ?? selectedNonFungible?.iconUrl ?? ''}
                      onChange={(value) => setField('nftImageUrl', value)}
                      disabled={isSending || inputsDisabled}
                    />
                    {/* Whatever else this resource's schema declares. The mint
                        must carry every field, so these are not optional. */}
                    {customFields.map((sample) => (
                      <TextField
                        key={sample.name}
                        label={sample.name}
                        // What an existing NFT carries is the clearest hint;
                        // an empty one falls back to its type and a sample.
                        placeholder={
                          sample.value || nftFieldPlaceholder(sample.kind)
                        }
                        value={fields[customFieldKey(sample.name)] ?? ''}
                        onChange={(value) =>
                          setField(customFieldKey(sample.name), value)
                        }
                        disabled={
                          isSending ||
                          inputsDisabled ||
                          !isEditableNftFieldKind(sample.kind)
                        }
                      />
                    ))}
                    {customFieldNames.length > 0 && (
                      <p
                        className="sm:col-span-2 text-xs leading-relaxed"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {labels.fields.nftCustomFieldsNote}
                      </p>
                    )}
                  </div>
                )}

                {activeAction === 'editNftData' && selectedNonFungible && (
                  <div className="space-y-3">
                    {/* Same picker as burning, single choice: the NFT whose
                        data is rewritten. Only ids this account holds are
                        offered, which is also what the proof will cover. */}
                    <SearchField
                      value={burnNftSearch}
                      onChange={setBurnNftSearch}
                      placeholder={labels.fields.searchNfts.replace(
                        '{count}',
                        selectedNonFungible.ids.length.toString(),
                      )}
                      disabled={isSending || inputsDisabled}
                    />
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {(ownedNftData ||
                        selectedNonFungible.ids.map((id) => ({
                          id,
                          name: selectedNonFungible.name || labels.fields.unnamedNft,
                          imageUrl: selectedNonFungible.iconUrl,
                        })))
                        .filter(
                          (nft) =>
                            !burnNftSearch ||
                            nft.id.toLowerCase().includes(burnNftSearch.toLowerCase()) ||
                            nft.name?.toLowerCase().includes(burnNftSearch.toLowerCase()),
                        )
                        .map((nft) => {
                          const isSelected = editNftId === nft.id;
                          return (
                            <button
                              key={nft.id}
                              type="button"
                              disabled={isSending || inputsDisabled}
                              onClick={() => setEditNftId(isSelected ? null : nft.id)}
                              className="group flex items-center gap-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-sm active:scale-95 p-2.5"
                              style={{
                                background: isSelected
                                  ? 'rgba(var(--color-primary-rgb), 0.08)'
                                  : 'var(--color-surface)',
                                borderColor: isSelected
                                  ? 'var(--color-primary)'
                                  : 'var(--color-card-border)',
                              }}
                              title={nft.id}
                            >
                              <SafeImage
                                src={nft.imageUrl || selectedNonFungible.iconUrl || ''}
                                alt={nft.id}
                                fallbackName={nft.name || selectedNonFungible.name || labels.fields.unnamedNft}
                                className="size-8 rounded-lg object-cover shadow-sm shrink-0"
                              />
                              <div className="flex min-w-0 flex-col">
                                <span
                                  className="truncate font-bold text-xs leading-tight"
                                  style={{
                                    color: isSelected
                                      ? 'var(--color-primary)'
                                      : 'var(--color-text-main)',
                                  }}
                                >
                                  {nft.name || 'NFT'}
                                </span>
                                <span
                                  className="truncate font-mono text-[10px]"
                                  style={{ color: 'var(--color-text-muted)' }}
                                >
                                  {nft.id}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                    {/* Some resources declare NO mutable field at all (the
                        Radix Seal brand is one): no role and no badge can ever
                        change their NFTs, so say that instead of offering a
                        form full of dead inputs. */}
                    {editNftId && mutableNftFields.length === 0 && (
                      <p
                        className="flex items-start gap-2 rounded-xl border px-4 py-3 text-xs leading-relaxed"
                        style={{
                          borderColor: 'var(--color-card-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        <Lock className="mt-0.5 size-3.5 shrink-0" />
                        {labels.fields.nftDataAllLocked}
                      </p>
                    )}
                    {editNftId && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {nftFields.map((nftField) => {
                          // Same treatment as a metadata key that is already
                          // locked on-ledger: read-only, with the lock chip
                          // saying so. NFT fields have no lock/unlock
                          // instruction at all — the schema decides at creation
                          // — so a mutable one simply carries no chip.
                          const editable = mutableNftFields.includes(nftField.name);
                          const key = nftFieldKey(nftField.name);
                          return (
                            <TextField
                              key={nftField.name}
                              label={nftField.name}
                              labelEnd={
                                editable ? undefined : (
                                  <LockToggle
                                    locked
                                    onToggle={() => undefined}
                                    disabled
                                    label={labels.fields.alreadyLockedLabel}
                                    hint={labels.fields.nftDataLockedHint}
                                  />
                                )
                              }
                              placeholder={nftFieldPlaceholder(nftField.kind)}
                              value={fields[key] ?? nftField.value}
                              onChange={(value) => setField(key, value)}
                              disabled={
                                !editable ||
                                !isEditableNftFieldKind(nftField.kind) ||
                                isSending ||
                                inputsDisabled
                              }
                            />
                          );
                        })}
                        {nftFields.length === 0 && (
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {labels.fields.nftDataLoading}
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                      {labels.fields.nftDataNote}
                    </p>
                  </div>
                )}

                {activeAction === 'lockMetadata' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(rolesData?.details?.metadata?.items as MetadataItem[] | undefined)?.map((item) => {
                      const alreadyLocked = item.is_locked;
                      const markedToLock = lockedMetaKeys.has(item.key);
                      // Every metadata type: scalar (`value`), array (`values`),
                      // url/identifier, else the raw hex fallback.
                      const displayVal = formatMetadataValue(item.value?.typed) || item.value?.raw_hex || '';
                      // Unlocked keys of a supported type can be edited (SET) as
                      // well as locked; locked ones stay read-only.
                      const editable =
                        !alreadyLocked && isEditableMetadataType(item.value?.typed?.type);
                      const editKey = `meta:${resource}:${item.key}`;

                      return (
                        <TextField
                          key={item.key}
                          label={item.key}
                          hint={editable ? labels.fields.editMetadataHint : undefined}
                          labelEnd={
                            <LockToggle
                              locked={alreadyLocked || markedToLock}
                              onToggle={() => {
                                if (alreadyLocked) return; // already locked on-ledger, can't unlock
                                const next = new Set(lockedMetaKeys);
                                if (markedToLock) next.delete(item.key);
                                else next.add(item.key);
                                setLockedMetaKeys(next);
                              }}
                              disabled={isSending || inputsDisabled || alreadyLocked}
                              label={
                                alreadyLocked
                                  ? labels.fields.alreadyLockedLabel
                                  : labels.fields.lockFieldLabel
                              }
                              hint={alreadyLocked ? labels.fields.alreadyLockedHint : labels.fields.lockFieldHint}
                            />
                          }
                          value={editable ? (fields[editKey] ?? displayVal) : displayVal}
                          disabled={!editable || isSending || inputsDisabled}
                          onChange={editable ? (v) => setField(editKey, v) : () => {}}
                        />
                      );
                    })}
                  </div>
                )}

                {activeAction === 'setOwnerRole' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                        {labels.fields.accessRule}
                      </span>
                      <OptionButtons
                        options={[
                          { value: 'allowAll', label: common.ownerRole_allowAll, title: t.createToken.optionHints.allowAll },
                          { value: 'denyAll', label: t.createToken.denyAll, title: t.createToken.optionHints.denyAll },
                          { value: 'badge', label: common.ownerRole_badge },
                        ]}
                        value={fields.ruleKind || ruleType}
                        onChange={(value) => setField('ruleKind', value)}
                        size="sm"
                        disabled={isSending || inputsDisabled}
                      />
                    </div>
                    {(fields.ruleKind || ruleType) === 'badge' && (() => {
                      const filteredBadges = resourceOptions.filter((opt) =>
                        opt.name.toLowerCase().includes(badgeSearch.toLowerCase()) ||
                        opt.value.toLowerCase().includes(badgeSearch.toLowerCase())
                      );
                      return (
                        <div className="flex flex-col gap-2 mt-2">
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                            {common.badgeResource}
                          </span>
                          <SearchField
                            value={badgeSearch}
                            onChange={setBadgeSearch}
                            placeholder={labels.fields.searchBadge}
                            disabled={isSending || inputsDisabled}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                            {filteredBadges.map((opt) => {
                              const isActive = opt.value === fields.badgeResource;
                              return (
                                <ResourceCard
                                  key={opt.value}
                                  isActive={isActive}
                                  disabled={isSending || inputsDisabled}
                                  onClick={() => setField('badgeResource', isActive ? '' : opt.value)}
                                  name={opt.name}
                                  address={opt.address}
                                  fullAddress={opt.value}
                                  iconUrl={opt.iconUrl}
                                />
                              );
                            })}
                            {resourceOptions.length > 0 && filteredBadges.length === 0 && (
                              <div className="col-span-1 sm:col-span-3 text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {labels.fields.noResults}
                              </div>
                            )}
                            {resourceOptions.length === 0 && (
                              <div className="col-span-1 sm:col-span-3 text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {labels.fields.noBadgesFound}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {(activeAction === 'freeze' || activeAction === 'recall') && (
                  <div className="flex flex-col gap-1.5">
                    <AddressField
                      label={labels.fields.vault}
                      hint={labels.fields.vaultHint}
                      value={fields.vault ?? ''}
                      onChange={(value) => setField('vault', value)}
                      placeholder={labels.fields.vaultPlaceholder}
                      disabled={isSending || inputsDisabled}
                      categories={['account']}
                    />
                    {targetInput && targetKind(targetInput) === 'unknown' && (
                      <span className="text-[11px] px-1" style={{ color: 'var(--color-danger, #dc2626)' }}>
                        {labels.fields.vaultInvalid}
                      </span>
                    )}
                    {resolvingTarget && (
                      <span className="text-[11px] px-1" style={{ color: 'var(--color-text-muted)' }}>
                        {labels.fields.vaultResolving}
                      </span>
                    )}
                    {!resolvingTarget && targetKind(targetInput) === 'account' && resolveError && (
                      <span className="text-[11px] px-1" style={{ color: 'var(--color-danger, #dc2626)' }}>
                        {labels.fields.vaultResolveError}
                      </span>
                    )}
                    {!resolvingTarget &&
                      targetKind(targetInput) === 'account' &&
                      !resolveError &&
                      resolvedTarget === null && (
                        <span className="text-[11px] px-1" style={{ color: 'var(--color-danger, #dc2626)' }}>
                          {labels.fields.vaultNotHeld}
                        </span>
                      )}
                    {!resolvingTarget && resolvedTarget && targetKind(targetInput) === 'account' && (
                      <span className="text-[11px] px-1 font-mono truncate" style={{ color: 'var(--color-primary)' }}>
                        {labels.fields.vaultResolved.replace('{vault}', truncateAddress(resolvedTarget.vault, 8, 6))}
                        {isNonFungible ? ` · ${resolvedNftIds().length} NFT` : ''}
                      </span>
                    )}
                  </div>
                )}
                {activeAction === 'recall' && isFungible && (
                  <TextField
                    label={labels.fields.amount}
                    value={isActionDenied ? (selectedFungible?.amount ?? '') : (fields.amount ?? '')}
                    onChange={(value) => setField('amount', value)}
                    type="number"
                    placeholder={selectedFungible ? `Saldo: ${formatNumber(Number(selectedFungible.amount), 4, language)}` : ''}
                    disabled={isSending || inputsDisabled}
                  />
                )}
                {activeAction === 'recall' && isNonFungible && (
                  <div className="flex flex-col gap-3">
                    <SearchField
                      value={recallNftSearch}
                      onChange={setRecallNftSearch}
                      placeholder={labels.fields.searchVaults.replace('{count}', allVaultsData.length.toString())}
                      disabled={isSending || inputsDisabled}
                    />
                    <div className="flex items-center gap-2 text-xs font-medium px-1" style={{ color: 'var(--color-primary)', visibility: recallVaults.size > 0 ? 'visible' : 'hidden' }}>
                      <Undo2 className="size-3.5" />
                      <span>{recallVaults.size === 1 ? labels.fields.vaultsSelected.replace('{count}', '1') : labels.fields.vaultsSelectedPlural.replace('{count}', recallVaults.size.toString())}</span>
                      <button
                        type="button"
                        onClick={() => setRecallVaults(new Set())}
                        className="ml-auto text-[11px] underline cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {labels.fields.clearSelection}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {filterVaultsBySearch(recallNftSearch)
                        .slice(0, VAULT_CARD_LIMIT)
                        .map((vault) =>
                          renderVaultCard(
                            vault,
                            recallVaults.has(vault.address),
                            () => {
                              setRecallVaults((prev) => {
                                const next = new Set(prev);
                                if (next.has(vault.address)) next.delete(vault.address);
                                else next.add(vault.address);
                                return next;
                              });
                            },
                            isSending || inputsDisabled,
                          ),
                        )}
                      {filterVaultsBySearch(recallNftSearch).length === 0 && (
                        <div className="col-span-full text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {labels.fields.noVaultsFound}
                        </div>
                      )}
                      {filterVaultsBySearch(recallNftSearch).length > VAULT_CARD_LIMIT && (
                        <div className="col-span-full text-center py-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          {labels.fields.vaultsLimited
                            .replace('{shown}', String(VAULT_CARD_LIMIT))
                            .replace('{total}', String(filterVaultsBySearch(recallNftSearch).length))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeAction === 'freeze' && isNonFungible && (
                  <div className="flex flex-col gap-3">
                    <SearchField
                      value={freezeVaultSearch}
                      onChange={setFreezeVaultSearch}
                      placeholder={labels.fields.searchVaults.replace('{count}', allVaultsData.length.toString())}
                      disabled={isSending || inputsDisabled}
                    />
                    <div className="flex items-center gap-2 text-xs font-medium px-1" style={{ color: 'var(--color-primary)', visibility: freezeVaults.size > 0 ? 'visible' : 'hidden' }}>
                      <Snowflake className="size-3.5" />
                      <span>{freezeVaults.size === 1 ? labels.fields.vaultsSelected.replace('{count}', '1') : labels.fields.vaultsSelectedPlural.replace('{count}', freezeVaults.size.toString())}</span>
                      <button
                        type="button"
                        onClick={() => setFreezeVaults(new Set())}
                        className="ml-auto text-[11px] underline cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {labels.fields.clearSelection}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                      {filterVaultsBySearch(freezeVaultSearch)
                        .slice(0, VAULT_CARD_LIMIT)
                        .map((vault) =>
                          renderVaultCard(
                            vault,
                            freezeVaults.has(vault.address),
                            () => {
                              setFreezeVaults((prev) => {
                                const next = new Set(prev);
                                if (next.has(vault.address)) next.delete(vault.address);
                                else next.add(vault.address);
                                return next;
                              });
                            },
                            isSending || inputsDisabled,
                          ),
                        )}
                      {filterVaultsBySearch(freezeVaultSearch).length === 0 && (
                        <div className="col-span-full text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {labels.fields.noVaultsFound}
                        </div>
                      )}
                      {filterVaultsBySearch(freezeVaultSearch).length > VAULT_CARD_LIMIT && (
                        <div className="col-span-full text-center py-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          {labels.fields.vaultsLimited
                            .replace('{shown}', String(VAULT_CARD_LIMIT))
                            .replace('{total}', String(filterVaultsBySearch(freezeVaultSearch).length))}
                        </div>
                      )}
                    </div>
                  </div>
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
                      disabled={isSending || inputsDisabled}
                    />
                    <OptionButtons
                      options={FREEZE_FLAGS.map((flag) => ({
                        value: flag,
                        label: (labels.fields.flags as Record<string, string>)[flag] ?? flag,
                      }))}
                      value={fields.flag ?? ''}
                      onChange={(value) => setField('flag', value)}
                      size="sm"
                      disabled={isSending || inputsDisabled}
                    />
                  </>
                )}
              </>
            );
          })()}

          {showManifest && manifest && <ManifestCode code={manifest} />}
        </ToolSection>
      )}

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
          disabled={!canSend}
          loading={preview.isSimulating}
        />
      </div>
      <SimulateResultCard t={t.simulate} preview={preview.preview} error={preview.error} onClose={preview.reset} />
      <TxResultBanner t={common} result={result} error={error} onReset={reset}  preview={preview.preview} />

    </div>
  );
}
