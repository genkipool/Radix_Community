'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Activity, BookUser, CornerDownLeft, Crown, Database, Plus, ServerCog, Wallet } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { SafeImage } from '@/components/ui/SafeImage';
import { SelectPopup, SelectPopupEmpty, SelectPopupRow, SelectPopupTabs, selectedFirst, useSelectionDraft } from '@/components/ui/SelectPopup';
import { useLanguage } from '@/context/LanguageContext';
import { apiFetchValidators } from '@/features/dashboard/services/apiClient';
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
import { fetchOwnedValidators } from '../../hooks/useOwnedValidators';
import type { KnownPoolRow } from '../../lib/known-pools';
import { findLedgerEntities, type LedgerEntityKind } from '../../lib/ledger-entities';

/** Where an option comes from; also the popup's tabs, in this order. */
const SOURCES = ['wallet', 'myValidators', 'agenda', 'mine', 'ociswap', 'defiplaza', 'network', 'validators'] as const;
type Tab = 'all' | (typeof SOURCES)[number];
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
/** Shown before searching; the search runs over everything found. */
const INITIAL_ROWS = 40;
/** Tall enough for about eight rows, short enough not to cover the form. */
const MAX_HEIGHT = 420;

const fmtAmount = (amount: string) => Number(amount).toLocaleString(undefined, { maximumFractionDigits: 4 });

const TEXT = {
  es: {
    search: 'Buscar por nombre o dirección…',
    empty: 'No hay direcciones de este tipo. Guárdalas en la agenda.',
    noMatch: 'Nada coincide con la búsqueda.',
    pick: 'Elegir dirección',
    pickBy: {
      account: 'Elegir cuenta',
      resource: 'Elegir recurso',
      validator: 'Elegir validador',
      pool: 'Elegir pool',
      locker: 'Elegir locker',
      component: 'Elegir componente',
      package: 'Elegir paquete',
    } as Partial<Record<AddressCategory, string>>,
    loading: 'Buscando…',
    more: 'Hay {count} más: usa el buscador.',
    typedLabel: 'Usar esta dirección',
    fee: 'Comisión',
    add: 'Añadir',
    addCount: 'Añadir ({count})',
    close: 'Cerrar',
    ownBadge: 'Tienes su insignia',
    tabs: {
      all: 'Todas',
      wallet: 'Tu billetera',
      myValidators: 'Tuyos',
      agenda: 'Agenda',
      mine: 'Usados por ti',
      ociswap: 'Ociswap',
      defiplaza: 'DefiPlaza',
      network: 'Actividad reciente',
      validators: 'Validadores',
    },
    unnamed: { pool: 'Pool sin nombre', locker: 'Locker sin nombre', resource: 'Recurso sin nombre', other: 'Sin nombre' },
  },
  en: {
    search: 'Search by name or address…',
    empty: 'No addresses of this type. Save some in the address book.',
    noMatch: 'Nothing matches the search.',
    pick: 'Pick address',
    pickBy: {
      account: 'Pick account',
      resource: 'Pick resource',
      validator: 'Pick validator',
      pool: 'Pick pool',
      locker: 'Pick locker',
      component: 'Pick component',
      package: 'Pick package',
    } as Partial<Record<AddressCategory, string>>,
    loading: 'Searching…',
    more: '{count} more: use the search.',
    typedLabel: 'Use this address',
    fee: 'Fee',
    add: 'Add',
    addCount: 'Add ({count})',
    close: 'Close',
    ownBadge: 'You hold its badge',
    tabs: {
      all: 'All',
      wallet: 'Your wallet',
      myValidators: 'Yours',
      agenda: 'Address book',
      mine: 'Used by you',
      ociswap: 'Ociswap',
      defiplaza: 'DefiPlaza',
      network: 'Recent activity',
      validators: 'Validators',
    },
    unnamed: { pool: 'Unnamed pool', locker: 'Unnamed locker', resource: 'Unnamed resource', other: 'Unnamed' },
  },
};

const SOURCE_ICON: Record<Source, ReactNode> = {
  wallet: <Wallet className="size-3.5 text-[var(--color-primary)]" />,
  myValidators: <Crown className="size-3.5 text-[var(--color-primary)]" />,
  typed: <CornerDownLeft className="size-3.5 text-[var(--color-text-muted)]" />,
  agenda: <BookUser className="size-3.5 text-[var(--color-text-muted)]" />,
  mine: <Database className="size-3.5 text-[var(--color-primary)]" />,
  ociswap: <Activity className="size-3.5 text-[var(--color-text-muted)]" />,
  defiplaza: <Activity className="size-3.5 text-[var(--color-text-muted)]" />,
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
 *   native pools Ociswap and DefiPlaza publish (mainnet) and pools with recent
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

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const L = language === 'es' ? TEXT.es : TEXT.en;
  // Named after what it picks when it picks one kind only.
  const pickTitle = (categories.length === 1 && L.pickBy[categories[0]]) || L.pick;

  const accepts = (c: AddressCategory) => categories.includes(c);
  const ledgerKinds = LEDGER_KINDS.filter((k) => accepts(k));
  const accountAddresses = accounts.map((a) => a.address);

  // Everything below loads only once the popup is open, and is cached after.
  const { data: holdings, isFetching: holdingsLoading } = useAccountResources(
    open && accepts('resource') ? accountAddresses : null,
  );
  // One lookup for pools and lockers together, shared by every picker on the
  // page and kept 30 minutes: the last 100 transactions of each account plus
  // one page of recent pool activity, a few dozen KB in all.
  const { data: ledgerAll, isFetching: ledgerLoading } = useQuery({
    queryKey: ['console-ledger-entities', activeNetwork, accountAddresses.join(',')],
    enabled: open && ledgerKinds.length > 0,
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: () =>
      findLedgerEntities((path, body) => gatewayPost(activeNetwork, path, body), {
        accounts: accountAddresses,
        kinds: LEDGER_KINDS,
        accountPages: 1,
      }),
  });
  const ledger = ledgerAll?.filter((e) => ledgerKinds.includes(e.kind));
  const { data: knownPools, isFetching: knownLoading } = useQuery({
    queryKey: ['console-known-pools', activeNetwork],
    enabled: open && accepts('pool') && activeNetwork === 'mainnet',
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
  const { data: validators, isFetching: validatorsLoading } = useQuery({
    queryKey: ['console-picker-validators', activeNetwork],
    enabled: open && accepts('validator'),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => (await apiFetchValidators(activeNetwork)).validators,
  });
  const ownerBadge = RADIX_TOKEN_ADDRESSES[activeNetworkId ?? RadixNetworkId.Mainnet].OWNER_BADGE;
  const { data: myValidators, isFetching: myValidatorsLoading } = useQuery({
    queryKey: ['console-picker-owned-validators', activeNetwork, accountAddresses.join(',')],
    enabled: open && accepts('validator') && accountAddresses.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () =>
      (
        await Promise.all(
          accountAddresses.map((account) => fetchOwnedValidators(account, activeNetwork, ownerBadge).catch(() => [])),
        )
      ).flat(),
  });
  // Soulbound resources (withdrawer DenyAll) are left out when the input is for sending.
  const locked = useLockedResources(
    sendableOnly && open ? [...(holdings?.fungibles ?? []), ...(holdings?.nonFungibles ?? [])].map((r) => r.resourceAddress) : [],
    activeNetwork,
  );
  const loading = holdingsLoading || ledgerLoading || knownLoading || validatorsLoading || myValidatorsLoading;

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
  (ledger ?? []).filter((e) => !e.mine).forEach((e) => add({ address: e.address, label: e.name, source: 'network', category: e.kind }));
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

  const counts = SOURCES.map((src) => [src, options.filter((o) => o.source === src).length] as const).filter(([, n]) => n > 0);
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

  const q = query.trim().toLowerCase();
  const unique = options.filter((o, i) => options.findIndex((x) => x.address === o.address) === i);
  const inTab = activeTab === 'all' ? [...typedSelected, ...unique] : options.filter((o) => o.source === activeTab);
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
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setQuery('');
    setTab('all');
    if (multi) draft.open(selected);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!btnRef.current?.contains(n) && !popRef.current?.contains(n)) setOpen(false);
    };
    const reposition = () => {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const style: CSSProperties = (() => {
    if (typeof window === 'undefined' || !rect) {
      return { position: 'fixed', left: 12, top: 72, width: 320, zIndex: 9999 };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(440, vw - 24);
    const left = Math.min(Math.max(12, rect.right - width), Math.max(12, vw - width - 12));
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const below = spaceBelow >= 240 || spaceBelow >= spaceAbove;
    const room = (space: number) => Math.min(MAX_HEIGHT, Math.max(200, space - 16));
    return below
      ? { position: 'fixed', left, top: rect.bottom + 6, width, height: room(spaceBelow), zIndex: 9999 }
      : { position: 'fixed', left, bottom: vh - rect.top + 6, width, height: room(spaceAbove), zIndex: 9999 };
  })();

  const pick = (address: string) => {
    if (multi) {
      // Unticking something already added drops it at once; new picks wait for "Add".
      const dropping = draft.draft.includes(address) && selected.includes(address);
      draft.toggle(address);
      if (dropping) onConfirm?.(selected.filter((a) => a !== address));
      if (address === typed) setQuery('');
      return;
    }
    onSelect?.(address);
    setOpen(false);
  };

  const confirm = () => {
    onConfirm?.(draft.draft);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={openPopup}
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
                ref={popRef}
                style={style}
                direction={style.bottom !== undefined ? 'up' : 'down'}
                onClose={() => setOpen(false)}
                closeLabel={L.close}
                title={pickTitle}
                header={
                  counts.length > 1 ? (
                    <SelectPopupTabs
                      tabs={([['all', unique.length + typedSelected.length] as const, ...counts]).map(([key, count]) => ({
                        value: key,
                        label: L.tabs[key],
                        count,
                      }))}
                      active={activeTab}
                      onChange={setTab}
                      onClose={() => setOpen(false)}
                      closeLabel={L.close}
                    />
                  ) : undefined
                }
                search={{ value: query, onChange: setQuery, placeholder: L.search, autoFocus: true, onEnter: multi ? confirm : undefined }}
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
