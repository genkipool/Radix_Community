'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Activity, BookUser, CornerDownLeft, Crown, Database, Plus, ServerCog, Wallet } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useValidatorList } from '@/features/dashboard/staking';
import { SafeImage } from '@/components/ui/SafeImage';
import {
  SelectPopup,
  SelectPopupEmpty,
  SelectPopupRow,
  SelectPopupTabs,
  selectPopupTabsWidth,
  selectedFirst,
  useSelectionDraft,
} from '@/components/ui/SelectPopup';
import { useLanguage } from '@/context/LanguageContext';
import pickerEn from '../../locales/addressPicker.en.json';
import pickerEs from '../../locales/addressPicker.es.json';
import {
  useAddressBook,
  addressCategory,
  type AddressCategory,
} from '@/features/wallet/hooks/useAddressBook';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { shortAddress } from '@/utils/format';
import { useAccountResources } from '../../hooks/useAccountResources';
import { useLockedResources } from '../../hooks/useLockedResources';
import { usePickerPopup } from '../../hooks/usePickerPopup';
import { fetchOwnedValidators } from '../../hooks/useOwnedValidators';
import type { KnownPoolRow } from '../../lib/known-pools';
import { isNonFungibleResource } from '../../lib/bulk-send';
import { findLedgerEntities, type LedgerEntity, type LedgerEntityKind } from '../../lib/ledger-entities';
import { browserCopyOptions, writeBrowserCopy } from '../../lib/browser-copy';

/** Where an option comes from; also the popup's tabs, in this order. */
const SOURCES = ['wallet', 'myValidators', 'agenda', 'mine', 'ociswap', 'defiplaza', 'reddicks', 'network', 'validators'] as const;
/** A picker of resources only is split by kind instead: tokens and NFTs. */
const KINDS = ['tokens', 'nfts'] as const;
type Tab = 'all' | (typeof SOURCES)[number] | (typeof KINDS)[number];
/** `typed`: a selected address no list has; it shows under "All" only. */
type Source = (typeof SOURCES)[number] | 'typed';

interface PickerOption {
  address: string;
  /** Name, or '' when the entity has none. */
  label: string;
  /** A short fact next to the address: an amount held, a fee, a DEX. */
  detail?: string;
  iconUrl?: string;
  source: Source;
  category: AddressCategory;
}

const LEDGER_KINDS: LedgerEntityKind[] = ['pool', 'locker'];
/** Popup width bounds; between them it fits its tabs (see `selectPopupTabsWidth`). */
const MIN_WIDTH = 440;
const MAX_WIDTH = 880;

/** Shown before searching; the search runs over everything found. */
const INITIAL_ROWS = 40;
/** Tall enough for about eight rows, short enough not to cover the form. */

const fmtAmount = (amount: string) => Number(amount).toLocaleString(undefined, { maximumFractionDigits: 4 });

/** Every language at once: the popup is as wide as its tabs need in the widest one. */
const TEXT = { es: pickerEs, en: pickerEn } as const satisfies Record<string, typeof pickerEn>;

const SOURCE_ICON: Record<Source, ReactNode> = {
  wallet: <Wallet className="size-3.5 text-[var(--color-primary)]" />,
  myValidators: <Crown className="size-3.5 text-[var(--color-primary)]" />,
  typed: <CornerDownLeft className="size-3.5 text-[var(--color-text-muted)]" />,
  agenda: <BookUser className="size-3.5 text-[var(--color-text-muted)]" />,
  mine: <Database className="size-3.5 text-[var(--color-primary)]" />,
  ociswap: <Activity className="size-3.5 text-[var(--color-text-muted)]" />,
  defiplaza: <Activity className="size-3.5 text-[var(--color-text-muted)]" />,
  reddicks: <Activity className="size-3.5 text-[var(--color-text-muted)]" />,
  network: <Activity className="size-3.5 text-[var(--color-text-muted)]" />,
  validators: <ServerCog className="size-3.5 text-[var(--color-text-muted)]" />,
};

/**
 * A small "+" button next to an address input. It opens a portal popup listing
 * addresses the input accepts, filtered to the given `categories`, in tabs by
 * where they come from:
 *
 * - the wallet: its accounts, and for resource inputs what those accounts hold;
 * - the saved agenda;
 * - for pools and lockers, the ones the wallet's accounts have touched, the
 *   native pools Ociswap, DefiPlaza and Reddicks publish (mainnet) and pools with recent
 *   network activity;
 * - for validators, the ones the wallet's accounts own and the validator set.
 *
 * Each row shows the name on top and the address under it; typing a full
 * address the lists do not have offers it as is.
 *
 * With `onConfirm` it picks several, like the wallet profile's popups: rows
 * toggle a draft, what was picked when it opened is listed first and checked,
 * unticking one of those removes it at once, and "Add" applies the new picks;
 * closing any other way discards them.
 */
export function AddressPickerButton({
  categories,
  onSelect,
  disabled,
  selected = [],
  onConfirm,
  sendableOnly = false,
}: {
  /** Address families this input accepts; the popup shows only these. */
  categories: AddressCategory[];
  onSelect?: (address: string) => void;
  disabled?: boolean;
  /** What is picked already: listed first and checked when the popup opens (one or several). */
  selected?: string[];
  /** Several at once: the new selection, when "Add" is pressed. */
  onConfirm?: (addresses: string[]) => void;
  /** Leave out the account's resources that can never leave it (to send them). */
  sendableOnly?: boolean;
}) {
  const { language } = useLanguage();
  const { entries } = useAddressBook();
  const { accounts, activeNetwork, activeNetworkId } = useRadixWallet();
  const multi = !!onConfirm;
  const draft = useSelectionDraft<string>();

  const { open, show: showPopup, close: closePopup, buttonRef, popupRef, layoutFor } = usePickerPopup();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  const L = TEXT[language] ?? TEXT.en;
  // Named after what it picks when it picks one kind only.
  const pickTitle = (categories.length === 1 && (L.pickBy as Partial<Record<AddressCategory, string>>)[categories[0]]) || L.pick;

  const accepts = (c: AddressCategory) => categories.includes(c);
  const ledgerKinds = LEDGER_KINDS.filter((k) => accepts(k));
  const accountAddresses = accounts.map((a) => a.address);

  // The lists load before the first click: once the page is idle, or as soon
  // as the pointer or focus reaches the button. Every picker on the page shares
  // the same cached queries, so this costs one load per page, not per button.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (disabled) return;
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setWarm(true), { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setWarm(true), 1000);
    return () => window.clearTimeout(id);
  }, [disabled]);
  const load = open || warm;

  // Everything below is cached once loaded.
  const { data: holdings, isFetching: holdingsLoading } = useAccountResources(
    load && accepts('resource') ? accountAddresses : null,
  );
  // One lookup for pools and lockers together, shared by every picker on the
  // page and kept 30 minutes: the last 100 transactions of each account, a few
  // dozen KB in all. Network-wide activity comes from the server below.
  // The account-specific lists below also keep their last answer in the
  // browser: it shows at once on the next visit and is replaced right away.
  const ledgerKey = ['console-ledger-entities', activeNetwork, accountAddresses.join(',')];
  const { data: ledgerAll, isFetching: ledgerLoading } = useQuery({
    queryKey: ledgerKey,
    ...browserCopyOptions<LedgerEntity[]>(ledgerKey),
    enabled: load && ledgerKinds.length > 0 && accountAddresses.length > 0,
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: async () => {
      const found = await findLedgerEntities((path, body) => gatewayPost(activeNetwork, path, body), {
        accounts: accountAddresses,
        kinds: LEDGER_KINDS,
        accountPages: 1,
        networkPages: 0,
      });
      writeBrowserCopy(ledgerKey, found);
      return found;
    },
  });
  const ledger = ledgerAll?.filter((e) => ledgerKinds.includes(e.kind));
  // Pools with recent network activity: the same for everyone, so the server
  // caches them and the tab shows up with the DEX lists instead of a second later.
  const { data: recentPools, isFetching: recentLoading } = useQuery({
    queryKey: ['console-recent-pools', activeNetwork],
    enabled: load && accepts('pool'),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/console/recent-pools?network=${activeNetwork}`);
      if (!res.ok) throw new Error(`recent pools: ${res.status}`);
      return ((await res.json()) as { pools: [address: string, name: string][] }).pools;
    },
  });
  const { data: knownPools, isFetching: knownLoading } = useQuery({
    queryKey: ['console-known-pools', activeNetwork],
    enabled: load && accepts('pool') && activeNetwork === 'mainnet',
    // Kept for the whole visit: the list is ~2,000 rows and changes a few times a day.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/console/known-pools?network=${activeNetwork}`);
      if (!res.ok) throw new Error(`known pools: ${res.status}`);
      return ((await res.json()) as { pools: KnownPoolRow[] }).pools;
    },
  });
  // The site's shared validator set: already loaded if the staking list or the explorer was opened.
  const { data: validatorSet, isFetching: validatorsLoading } = useValidatorList(activeNetwork, load && accepts('validator'));
  const validators = validatorSet?.validators;
  const ownerBadge = RADIX_TOKEN_ADDRESSES[activeNetworkId ?? RadixNetworkId.Mainnet].OWNER_BADGE;
  const myValidatorsKey = ['console-picker-owned-validators', activeNetwork, accountAddresses.join(',')];
  const { data: myValidators, isFetching: myValidatorsLoading } = useQuery({
    queryKey: myValidatorsKey,
    ...browserCopyOptions<Awaited<ReturnType<typeof fetchOwnedValidators>>>(myValidatorsKey),
    enabled: load && accepts('validator') && accountAddresses.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const owned = (
        await Promise.all(
          accountAddresses.map((account) => fetchOwnedValidators(account, activeNetwork, ownerBadge).catch(() => [])),
        )
      ).flat();
      writeBrowserCopy(myValidatorsKey, owned);
      return owned;
    },
  });
  // Soulbound resources (withdrawer DenyAll) are left out when the input is for sending.
  const locked = useLockedResources(
    sendableOnly && load ? [...(holdings?.fungibles ?? []), ...(holdings?.nonFungibles ?? [])].map((r) => r.resourceAddress) : [],
    activeNetwork,
  );
  const loading = holdingsLoading || ledgerLoading || recentLoading || knownLoading || validatorsLoading || myValidatorsLoading;

  // Earlier sources win when an address shows up in several.
  const options: PickerOption[] = [];
  // An address can sit in several tabs (a wallet account saved in the agenda
  // too); each tab lists it once, and "All" once overall.
  const add = (o: PickerOption) => {
    if (!options.some((x) => x.address === o.address && x.source === o.source)) options.push(o);
  };
  if (accepts('account')) {
    accounts.forEach((a) => add({ address: a.address, label: a.label || '', source: 'wallet', category: 'account' }));
  }
  if (accepts('resource')) {
    holdings?.fungibles.filter((f) => !locked.has(f.resourceAddress)).forEach((f) =>
      add({
        address: f.resourceAddress,
        label: f.name || f.symbol || '',
        detail: `${fmtAmount(f.amount)}${f.symbol ? ` ${f.symbol}` : ''}`,
        iconUrl: f.iconUrl,
        source: 'wallet',
        category: 'resource',
      }),
    );
    holdings?.nonFungibles.filter((n) => !locked.has(n.resourceAddress)).forEach((n) =>
      add({ address: n.resourceAddress, label: n.name || '', detail: `${n.ids.length} NFT`, iconUrl: n.iconUrl, source: 'wallet', category: 'resource' }),
    );
  }
  (accepts('validator') ? myValidators ?? [] : []).forEach((mv) => {
    const listed = validators?.find((v) => v.address === mv.address);
    add({
      address: mv.address,
      label: mv.name || listed?.name || '',
      detail: listed ? `${L.fee} ${listed.feePercent} %` : L.ownBadge,
      iconUrl: listed?.iconUrl,
      source: 'myValidators',
      category: 'validator',
    });
  });
  entries.forEach((e) => {
    const cat = e.category ?? addressCategory(e.address);
    if (accepts(cat)) add({ address: e.address, label: e.name, source: 'agenda', category: cat });
  });
  (ledger ?? []).filter((e) => e.mine).forEach((e) => add({ address: e.address, label: e.name, source: 'mine', category: e.kind }));
  // Queries are shared through the cache, so a list another picker loaded is
  // available here too: only use it when this input accepts that kind.
  if (accepts('pool')) {
    (knownPools ?? []).forEach(([address, label, source]) => add({ address, label, source, category: 'pool' }));
  }
  if (accepts('pool')) {
    (recentPools ?? [])
      .filter(([address]) => !ledger?.some((e) => e.address === address))
      .forEach(([address, label]) => add({ address, label, source: 'network', category: 'pool' }));
  }
  (accepts('validator') ? validators ?? [] : []).forEach((v) =>
    add({
      address: v.address,
      label: v.name,
      detail: `${L.fee} ${v.feePercent} %`,
      iconUrl: v.iconUrl,
      source: 'validators',
      category: 'validator',
    }),
  );

  const unique = options.filter((o, i) => options.findIndex((x) => x.address === o.address) === i);
  const byKind = categories.length === 1 && categories[0] === 'resource';
  const ofKind = (kind: (typeof KINDS)[number]) => unique.filter((o) => isNonFungibleResource(o.address) === (kind === 'nfts'));
  const counts: Array<readonly [Exclude<Tab, 'all'>, number]> = byKind
    ? KINDS.map((kind) => [kind, ofKind(kind).length] as const)
    : SOURCES.map((src) => [src, options.filter((o) => o.source === src).length] as const).filter(([, n]) => n > 0);
  const activeTab: Tab = tab === 'all' || counts.some(([src]) => src === tab) ? tab : 'all';

  // Picked addresses no list has (typed or pasted) still show, under "All".
  // Checked rows: the draft when picking several, what the field holds when picking one.
  const isSelected = (address: string) => (multi ? draft.draft.includes(address) : selected.includes(address));
  const pinned = multi ? draft.pinned : selected;
  const typedSelected: PickerOption[] = multi
    ? [...new Set([...draft.pinned, ...draft.draft])]
        .filter((address) => !options.some((o) => o.address === address))
        .map((address) => ({ address, label: '', source: 'typed', category: addressCategory(address) }))
    : [];
  const tabs = ([['all', unique.length + typedSelected.length] as const, ...counts]).map(([key, count]) => ({
    value: key,
    label: (lang: typeof L) => (key === 'all' && byKind ? lang.tabs.allResources : lang.tabs[key]),
    count,
  }));
  // As wide as the tabs need in the wider language, so switching language
  // keeps the size; past MAX_WIDTH they wrap onto another line.
  const popupWidth =
    counts.length > 1
      ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ...Object.values(TEXT).map((lang) => selectPopupTabsWidth(tabs.map((t) => `${t.label(lang)} (${t.count})`)))))
      : MIN_WIDTH;
  const { style: popupStyle, direction } = layoutFor(popupWidth);

  const q = query.trim().toLowerCase();
  const inTab =
    activeTab === 'all'
      ? [...typedSelected, ...unique]
      : activeTab === 'tokens' || activeTab === 'nfts'
        ? ofKind(activeTab)
        : options.filter((o) => o.source === activeTab);
  const found = q
    ? inTab.filter((o) => o.label.toLowerCase().includes(q) || o.address.toLowerCase().includes(q))
    : inTab;
  // What was picked when it opened goes first, and stays put while toggling.
  const matches = selectedFirst(found, pinned, (o) => o.address);
  const filtered = matches.slice(0, q ? 200 : INITIAL_ROWS + pinned.length);

  // A complete address of an accepted kind that no list has: offer it as typed.
  const typed = query.trim();
  const typedOption =
    typed.length > 40 && accepts(addressCategory(typed)) && !options.some((o) => o.address === typed) && !isSelected(typed)
      ? typed
      : null;

  const nameOf = (o: PickerOption) =>
    o.label || L.unnamed[o.category === 'pool' || o.category === 'locker' || o.category === 'resource' ? o.category : 'other'];

  const openPopup = () => {
    setQuery('');
    setTab('all');
    if (multi) draft.open(selected);
    showPopup();
  };

  const pick = (address: string) => {
    if (multi) {
      // Unticking something already added drops it at once; new picks wait for "Add".
      const dropping = draft.draft.includes(address) && selected.includes(address);
      draft.toggle(address);
      if (dropping) onConfirm?.(selected.filter((a) => a !== address));
      return;
    }
    onSelect?.(address);
    closePopup();
  };

  // The search text stays after a pick; once it is cleared, everything picked so far goes on top.
  const search = (value: string) => {
    setQuery(value);
    if (multi && !value.trim()) draft.repin();
  };

  const confirm = () => {
    onConfirm?.(draft.draft);
    closePopup();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={openPopup}
        onPointerEnter={() => setWarm(true)}
        onFocus={() => setWarm(true)}
        aria-label={pickTitle}
        title={pickTitle}
        className="flex size-7 items-center justify-center rounded-lg border transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: 'var(--color-bg)',
          borderColor: 'var(--color-card-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <Plus className="size-3.5" strokeWidth={3} />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <SelectPopup
                ref={popupRef}
                style={popupStyle}
                direction={direction}
                onClose={() => closePopup()}
                closeLabel={L.close}
                title={pickTitle}
                header={
                  counts.length > 1 ? (
                    <SelectPopupTabs
                      tabs={tabs.map((t) => ({ value: t.value, label: t.label(L), count: t.count }))}
                      active={activeTab}
                      onChange={setTab}
                      onClose={() => closePopup()}
                      closeLabel={L.close}
                    />
                  ) : undefined
                }
                search={{ value: query, onChange: search, placeholder: L.search, clearLabel: L.clearSearch, autoFocus: true, onEnter: multi ? confirm : undefined }}
                footer={
                  multi
                    ? { label: draft.draft.length ? L.addCount.replace('{count}', String(draft.draft.length)) : L.add, onClick: confirm }
                    : undefined
                }
              >
                {typedOption && (
                  <SelectPopupRow
                    selected={false}
                    onClick={() => pick(typedOption)}
                    icon={<CornerDownLeft className="size-3.5 text-[var(--color-primary)]" />}
                    label={L.typedLabel}
                    sublabel={<span className="font-mono">{shortAddress(typedOption)}</span>}
                  />
                )}
                {filtered.length === 0 && !typedOption ? (
                  <SelectPopupEmpty>{loading ? L.loading : q ? L.noMatch : L.empty}</SelectPopupEmpty>
                ) : (
                  filtered.map((o) => (
                    <SelectPopupRow
                      key={o.address}
                      selected={isSelected(o.address)}
                      showCheck={multi}
                      onClick={() => pick(o.address)}
                      title={o.address}
                      icon={
                        <span className="flex size-6 items-center justify-center">
                          {o.iconUrl ? (
                            <SafeImage src={o.iconUrl} alt="" fallbackName={nameOf(o)} zoomable={false} className="size-6 rounded-full object-cover" />
                          ) : (
                            SOURCE_ICON[o.source]
                          )}
                        </span>
                      }
                      label={o.label ? nameOf(o) : <span className="italic opacity-80">{nameOf(o)}</span>}
                      sublabel={
                        <>
                          <span className="font-mono">{shortAddress(o.address)}</span>
                          {o.detail && <> · {o.detail}</>}
                        </>
                      }
                    />
                  ))
                )}
                {loading && filtered.length > 0 && <SelectPopupEmpty>{L.loading}</SelectPopupEmpty>}
                {matches.length > filtered.length && (
                  <SelectPopupEmpty>{L.more.replace('{count}', String(matches.length - filtered.length))}</SelectPopupEmpty>
                )}
              </SelectPopup>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
