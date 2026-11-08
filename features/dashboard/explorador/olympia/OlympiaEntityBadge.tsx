'use client';
/**
 * An Olympia address (account, validator or token) as the Babylon explorer
 * draws an entity inside a transaction (ExpandableEntityBadge): the type tag
 * in the Babylon colours of that kind, the name when there is one, the short
 * address with copy, and a chevron. Clicked, it opens in place the tabs of
 * that entity's Olympia card.
 */
import React, { useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';
import type { TranslationsT } from '@/features/dashboard/types';
import type { MarketData } from '@/features/dashboard/types';
import { ENTITY_KINDS } from '@/features/dashboard/lib/entityKinds';
import { olympiaKindOf } from '@/features/dashboard/lib/olympia';
import { ExpandedEntityPanel } from '../components/ResourceCardParts';
import { OlympiaAccountCard } from './OlympiaAccountCard';
import { OlympiaValidatorCard } from './OlympiaValidatorCard';
import { OlympiaResourceCard } from './OlympiaResourceCard';

/** Olympia kinds in the Babylon kind whose look they take. */
const LOOK = { account: 'account', validator: 'validator', resource: 'resource' } as const;
const CARD = { account: OlympiaAccountCard, validator: OlympiaValidatorCard, resource: OlympiaResourceCard } as const;

export function OlympiaEntityBadge({ address, name, t, locale, onCopy, copiedAddress, marketData }: {
  address: string;
  /** Validator name or token symbol, when the transaction already knows it. */
  name?: string | null;
  t?: Partial<TranslationsT>;
  locale: string;
  onCopy: (v: string) => void;
  copiedAddress: string | null;
  marketData?: MarketData | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const tt = t?.dashboard?.transactions;
  const kind = olympiaKindOf(address);
  if (kind !== 'account' && kind !== 'validator' && kind !== 'resource') return null;

  const info = ENTITY_KINDS[LOOK[kind]];
  const label = tt?.[info.labelKey] || '';
  const short = address.length > 20 ? `${address.slice(0, 12)}...${address.slice(-6)}` : address;
  const copied = copiedAddress === address;
  const Panel = CARD[kind];

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.getSelection()?.toString()) return;
    setExpanded((v) => !v);
  };

  return (
    <div className={`flex flex-col border ${info.bg} overflow-hidden transition-all rounded-xl ${expanded ? 'shadow-lg shadow-black/10' : ''}`}>
      <div className="flex-1 flex items-center justify-between gap-2 p-2.5 hover:bg-white/5 min-h-[52px] cursor-pointer transition-colors group/entity" onClick={toggle}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[9px] uppercase font-black tracking-wider px-1.5 pt-[2px] pb-[1px] leading-none rounded ${info.bg} ${info.color} shrink-0`}>
            {label}
          </span>
          <div className="min-w-0 flex-1 flex flex-col">
            {name && <span className={`text-[11px] font-semibold truncate ${info.color}`}>{name}</span>}
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`font-mono text-xs truncate ${name ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`} title={address}>{short}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCopy(address); }}
            className={`p-1 rounded transition-colors ${copied ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'}`}
            title={tt?.copy_address}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
          <ChevronDown className={`size-3.5 text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
        </div>
      </div>

      <ExpandedEntityPanel expanded={expanded}>
        <Panel
          address={address}
          columns={1}
          isExpanded
          headless
          onCopy={onCopy}
          copiedAddress={copiedAddress}
          t={t}
          network="mainnet"
          locale={locale}
          marketData={marketData}
        />
      </ExpandedEntityPanel>
    </div>
  );
}
