'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Hash, Layers, Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { SelectPopup, SelectPopupEmpty, SelectPopupRow } from '@/components/ui/SelectPopup';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import { usePickerPopup } from '../../hooks/usePickerPopup';

const TEXT = {
  es: {
    pick: 'Elegir NFT',
    any: 'Cualquiera de la colección',
    anyHint: 'Vale cualquier NFT de este recurso',
    search: 'Buscar ID…',
    loading: 'Cargando los NFT…',
    empty: 'Esta colección no tiene NFT.',
    noMatch: 'Ningún ID coincide.',
    more: 'Solo se muestran los primeros {count}: escribe el ID si no está.',
    close: 'Cerrar',
  },
  en: {
    pick: 'Pick NFT',
    any: 'Any of the collection',
    anyHint: 'Any NFT of this resource will do',
    search: 'Search id…',
    loading: 'Loading the NFTs…',
    empty: 'This collection has no NFTs.',
    noMatch: 'No id matches.',
    more: 'Only the first {count} are listed: type the id if it is missing.',
    close: 'Close',
  },
};

/** Pages read at most: enough to pick from, without walking a huge collection. */
const MAX_PAGES = 3;

interface IdsPage {
  non_fungible_ids?: { total_count?: number; items?: string[]; next_cursor?: string | null };
}

/**
 * The "+" beside an NFT id input: lists the ids the collection has and picks
 * one, or "any of the collection" (an empty value). Same popup as the address
 * picker, so every "+" in the console behaves alike.
 */
export function NftIdPickerButton({ resource, value, onSelect }: { resource: string; value: string; onSelect: (id: string) => void }) {
  const { language } = useLanguage();
  const L = language === 'es' ? TEXT.es : TEXT.en;
  const { activeNetwork } = useRadixWallet();
  const { open, show, close, buttonRef, popupRef, style, direction } = usePickerPopup();
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['console-nft-ids', activeNetwork, resource],
    enabled: open,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const ids: string[] = [];
      let total = 0;
      let cursor: string | null | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await gatewayPost<IdsPage>(activeNetwork, '/state/non-fungible/ids', {
          resource_address: resource,
          ...(cursor ? { cursor } : {}),
        });
        ids.push(...(res.non_fungible_ids?.items ?? []));
        total = res.non_fungible_ids?.total_count ?? ids.length;
        cursor = res.non_fungible_ids?.next_cursor;
        if (!cursor) break;
      }
      return { ids, total };
    },
  });

  const q = query.trim().toLowerCase();
  const ids = (data?.ids ?? []).filter((id) => id.toLowerCase().includes(q));
  const pick = (id: string) => {
    onSelect(id);
    close();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setQuery('');
          show();
        }}
        aria-label={L.pick}
        title={L.pick}
        className="flex size-7 items-center justify-center rounded-lg border transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}
      >
        <Plus className="size-3.5" strokeWidth={3} />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <SelectPopup
                ref={popupRef}
                style={style}
                direction={direction}
                onClose={close}
                closeLabel={L.close}
                title={L.pick}
                search={{ value: query, onChange: setQuery, placeholder: L.search, autoFocus: true }}
              >
                {!q && (
                  <SelectPopupRow
                    selected={!value}
                    onClick={() => pick('')}
                    icon={<Layers className="size-3.5 text-[var(--color-primary)]" />}
                    label={L.any}
                    sublabel={L.anyHint}
                  />
                )}
                {isLoading ? (
                  <SelectPopupEmpty>{L.loading}</SelectPopupEmpty>
                ) : ids.length === 0 ? (
                  <SelectPopupEmpty>{q ? L.noMatch : L.empty}</SelectPopupEmpty>
                ) : (
                  ids.map((id) => (
                    <SelectPopupRow
                      key={id}
                      selected={id === value}
                      onClick={() => pick(id)}
                      icon={<Hash className="size-3.5" style={{ color: 'var(--color-text-muted)' }} />}
                      label={<span className="font-mono">{id}</span>}
                    />
                  ))
                )}
                {data && data.total > data.ids.length && (
                  <SelectPopupEmpty>{L.more.replace('{count}', String(data.ids.length))}</SelectPopupEmpty>
                )}
              </SelectPopup>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
