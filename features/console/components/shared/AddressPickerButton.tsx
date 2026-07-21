'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { BookUser, Plus, Search, Wallet } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import {
  useAddressBook,
  addressCategory,
  type AddressCategory,
} from '@/features/wallet/hooks/useAddressBook';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { shortAddress } from '@/utils/format';

interface PickerOption {
  address: string;
  label: string;
  source: 'wallet' | 'agenda';
  category: AddressCategory;
}

/**
 * A small "+" button next to an address input. It opens a portal popup listing
 * addresses the input accepts — wallet accounts (for account inputs) and the
 * saved agenda, filtered to the given `categories` — and fills the input on
 * pick. Because the accepted categories are passed in, each input only ever
 * offers addresses of the right kind.
 */
export function AddressPickerButton({
  categories,
  onSelect,
  disabled,
}: {
  /** Address families this input accepts; the popup shows only these. */
  categories: AddressCategory[];
  onSelect: (address: string) => void;
  disabled?: boolean;
}) {
  const { language } = useLanguage();
  const { entries } = useAddressBook();
  const { accounts } = useRadixWallet();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const L =
    language === 'es'
      ? { search: 'Buscar dirección…', empty: 'No hay direcciones de este tipo. Guárdalas en la agenda.', pick: 'Elegir dirección' }
      : { search: 'Search address…', empty: 'No addresses of this type. Save some in the address book.', pick: 'Pick address' };

  const accepts = (c: AddressCategory) => categories.includes(c);

  const options: PickerOption[] = [];
  if (accepts('account')) {
    accounts.forEach((a) =>
      options.push({ address: a.address, label: a.label || a.address, source: 'wallet', category: 'account' }),
    );
  }
  entries.forEach((e) => {
    const cat = e.category ?? addressCategory(e.address);
    if (accepts(cat) && !options.some((o) => o.address === e.address)) {
      options.push({ address: e.address, label: e.name, source: 'agenda', category: cat });
    }
  });

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.address.toLowerCase().includes(q))
    : options;

  const openPopup = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setQuery('');
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
    const width = Math.min(360, vw - 24);
    const left = Math.min(Math.max(12, rect.right - width), Math.max(12, vw - width - 12));
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const below = spaceBelow >= 240 || spaceBelow >= spaceAbove;
    return below
      ? { position: 'fixed', left, top: rect.bottom + 6, width, maxHeight: Math.max(200, vh - rect.bottom - 16), zIndex: 9999 }
      : { position: 'fixed', left, bottom: vh - rect.top + 6, width, maxHeight: Math.max(200, rect.top - 16), zIndex: 9999 };
  })();

  const pick = (address: string) => {
    onSelect(address);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={openPopup}
        aria-label={L.pick}
        title={L.pick}
        className="flex size-7 items-center justify-center rounded-lg border transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: 'var(--color-bg)',
          borderColor: 'var(--color-card-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <Plus className="size-3.5" strokeWidth={3} />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popRef}
            style={style}
            className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-2xl backdrop-blur-xl"
          >
            <div className="shrink-0 border-b border-[var(--color-card-border)] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={L.search}
                  className="w-full rounded-lg border border-[var(--color-card-border)] bg-[var(--color-bg)] py-1.5 pl-8 pr-2 text-xs text-[var(--color-text-main)] outline-none transition-colors focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-muted)]/60"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1 custom-scrollbar">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-[11px] text-[var(--color-text-muted)]">{L.empty}</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={`${o.source}-${o.address}`}
                    type="button"
                    onClick={() => pick(o.address)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-bg)]"
                  >
                    {o.source === 'wallet' ? (
                      <Wallet className="size-3.5 shrink-0 text-[var(--color-primary)]" />
                    ) : (
                      <BookUser className="size-3.5 shrink-0 text-[var(--color-text-muted)]" />
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold text-[var(--color-text-main)]">{o.label}</span>
                      <span className="truncate font-mono text-[10px] text-[var(--color-text-muted)]">
                        {shortAddress(o.address)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
